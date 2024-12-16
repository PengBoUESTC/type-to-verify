import {
  Project,
  type SourceFile,
  SyntaxKind,
  type Type,
  ts,
  SymbolFlags,
  type InterfaceDeclaration,
  type TypeAliasDeclaration,
  type EnumDeclaration,
} from 'ts-morph'
import { cwd } from 'node:process'
import { join } from 'node:path'

interface Options {
  /** cache TypeToValue instance or not */
  cache?: boolean
  /** file path need to parse */
  sourceFilePath: string
  /** ts confing file path */
  tsConfigFilePath?: string
}

export class TypeToVerify {
  project: Project
  constructor(options: Options) {
    this.project = this.init(options)
  }

  init(options: Options) {
    const { sourceFilePath, tsConfigFilePath = join(cwd(), 'tsconfig.json') } =
      options
    const project = new Project({
      tsConfigFilePath,
    })
    project.addSourceFilesAtPaths(sourceFilePath)

    return project
  }

  genLiteralValue(type: Type<ts.Type>) {
    if (type.isBooleanLiteral()) {
      // 获取布尔字面量的值
      return type.getText() === 'true'
    }
    return type.getLiteralValue()
  }

  genEnum(enumDeclaration?: EnumDeclaration) {
    if (!enumDeclaration) return []
    const members = enumDeclaration.getMembers()
    return members
  }

  generateValidator(type: Type, key = 'value'): string {
    if (type.isUndefined() || type.isVoid()) {
      return `${key} === undefined`
    }

    if (type.isNull()) {
      return `${key} === null`
    }

    if (type.isLiteral()) {
      return `${key} === ${this.genLiteralValue(type)}`
    }
    if (type.isString()) {
      return `typeof ${key} === "string"`
    }
    if (type.isNumber()) {
      return `typeof ${key} === "number"`
    }
    if (type.isBoolean()) {
      return `typeof ${key} === "boolean"`
    }
    if (type.isEnum()) {
      return `${this.genEnum(
        type
          .getSymbol()
          ?.getDeclarations()[0]
          .asKindOrThrow(SyntaxKind.EnumDeclaration),
      )}.includes(${key})`
    }
    if (type.isArray()) {
      const elementType = type.getArrayElementTypeOrThrow()
      return `Array.isArray(${key}) && ${key}.every((element, i) => ${this.generateValidator(elementType, `${key}[i]`)})`
    }
    if (type.isObject()) {
      const properties = type.getProperties()
      const checks = properties.map(prop => {
        const propName = prop.getName()
        const propType = prop.getTypeAtLocation(prop.getValueDeclarationOrThrow())
        const isOptional = prop.hasFlags(SymbolFlags.Optional)
        const check = `${this.generateValidator(propType, `${key}['${propName}']`)}`
        return isOptional
          ? `(!value.hasOwnProperty('${propName}') || ${check})`
          : `value.hasOwnProperty('${propName}') && ${check}`
      })
      return `typeof value === 'object' && value !== null && ${checks.join(' && ')}`
    }

    return 'true' // Fallback for any type
  }

  runBase(
    interfaceDeclaration?: InterfaceDeclaration | TypeAliasDeclaration,
  ) {
    if (!interfaceDeclaration) return 'return true'
    return `return ${this.generateValidator(interfaceDeclaration.getType())};`
  }

  run(path: string, typeValue: string) {
    const sourceFile = this.project?.getSourceFile(path)
    if (!sourceFile) return 'return true'
    return this.runBase(
      sourceFile.getInterface(typeValue) || sourceFile.getTypeAlias(typeValue),
    )
  }
}
