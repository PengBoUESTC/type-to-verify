import type { Address } from './dts/Address'

import { TypeToVerify } from '../lib/index'

const typeToVerify = new TypeToVerify({
  sourceFilePath: 'test/**/*.d.ts'
})

describe('base test',  () => {
  const result = typeToVerify.run('test/dts/Address.d.ts', 'Address')
  const address: Address = {
    province: 'ce',
    // provinceName: 1,
    child: [1, 2]
  }
  test('base test', () => {
    expect(result).toMatchSnapshot()
    const verify = new Function('value', result)
    expect(verify.toString()).toMatchSnapshot()
    expect(verify({
      address: ''
    })).toBeFalsy()
    expect(verify(address)).toBeTruthy()
  })
})