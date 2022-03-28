import { Contract, Wallet } from 'ethers'
import { Web3Provider } from 'ethers/providers'
import {
  BigNumber,
  bigNumberify,
  keccak256,
  defaultAbiCoder,
  toUtf8Bytes,
  solidityPack,
  FunctionDescription,
} from 'ethers/utils'
import { signTypedData_v4, TypedMessage } from 'eth-sig-util'

export const MINIMUM_LIQUIDITY = bigNumberify(10).pow(3)

const PERMIT_TYPEHASH = keccak256(
  toUtf8Bytes('Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)')
)

export function expandTo18Decimals(n: number): BigNumber {
  return bigNumberify(n).mul(bigNumberify(10).pow(18))
}

function getDomainSeparator(name: string, tokenAddress: string) {
  return keccak256(
    defaultAbiCoder.encode(
      ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
      [
        keccak256(toUtf8Bytes('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')),
        keccak256(toUtf8Bytes(name)),
        keccak256(toUtf8Bytes('1')),
        1,
        tokenAddress
      ]
    )
  )
}

export async function getApprovalDigest(
  token: Contract,
  approve: {
    owner: string
    spender: string
    value: BigNumber
  },
  nonce: BigNumber,
  deadline: BigNumber
): Promise<string> {
  const name = await token.name()
  const DOMAIN_SEPARATOR = getDomainSeparator(name, token.address)
  return keccak256(
    solidityPack(
      ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
      [
        '0x19',
        '0x01',
        DOMAIN_SEPARATOR,
        keccak256(
          defaultAbiCoder.encode(
            ['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256'],
            [PERMIT_TYPEHASH, approve.owner, approve.spender, approve.value, nonce, deadline]
          )
        )
      ]
    )
  )
}

export async function mineBlock(provider: Web3Provider, timestamp: number): Promise<void> {
  await new Promise(async (resolve, reject) => {
    ;(provider._web3Provider.sendAsync as any)(
      { jsonrpc: '2.0', method: 'evm_mine', params: [timestamp] },
      (error: any, result: any): void => {
        if (error) {
          reject(error)
        } else {
          resolve(result)
        }
      }
    )
  })
}

export function encodePrice(reserve0: BigNumber, reserve1: BigNumber) {
  return [reserve1.mul(bigNumberify(2).pow(112)).div(reserve0), reserve0.mul(bigNumberify(2).pow(112)).div(reserve1)]
}

interface MessageTypeProperty {
  name: string
  type: string
}

interface MessageTypes {
  EIP712Domain: MessageTypeProperty[]
  [additionalProperties: string]: MessageTypeProperty[]
}

export function getFunctionSignature( functionAbi: FunctionDescription, params: any[]): string {
  return functionAbi.encode(params);
}

export function getTransactionData(
  nonce: string,
  user: Wallet,
  functionAbi: FunctionDescription,
  params: any[],
  verifyingContract: string
): {
  r: string, 
  s: string, 
  v: number, 
  functionSignature: string
}  {
  const domainType = [
    { name: "name", type: "string" },
    { name: "version", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "verifyingContract", type: "address" }
  ];
  const metaTransactionType = [
    { name: "nonce", type: "uint256" },
    { name: "from", type: "address" },
    { name: "functionSignature", type: "bytes" }
  ];
  const domainData = {
    name: "UniswapV2",
    version: "1",
    verifyingContract: verifyingContract,
    chainId: 1337
  };
  const functionSignature: string = getFunctionSignature(functionAbi, params);
  const message: Record<string, unknown> = {
    nonce: parseInt(nonce),
    from: user.address,
    functionSignature: functionSignature
  };

  const data: TypedMessage<MessageTypes> = {
    types: {
      EIP712Domain: domainType,
      MetaTransaction: metaTransactionType
    },
    primaryType: 'MetaTransaction',
    message: message,
    domain: domainData
  };

  const signature: string = signTypedData_v4(
    Buffer.from(user.privateKey.substring(2, 66), 'hex'),
    { data: data }
  );

  let r: string = signature.slice(0, 66);
  let s: string = "0x".concat(signature.slice(66, 130));
  let vHex: string = "0x".concat(signature.slice(130, 132));
  let v: number = parseInt(vHex);
  if (![27, 28].includes(v)) v += 27;

  return {
    r,
    s,
    v,
    functionSignature,
  };
}