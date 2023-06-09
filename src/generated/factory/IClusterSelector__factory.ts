/* Autogenerated file. Do not edit manually. */
/* eslint-disable */

import { Contract, Signer, utils } from 'ethers'
import type { Provider } from '@ethersproject/providers'
import type { IClusterSelector, IClusterSelectorInterface } from '../IClusterSelector'

const _abi = [
  {
    inputs: [],
    name: 'EPOCH_LENGTH',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'START_TIME',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'key',
        type: 'address',
      },
    ],
    name: 'deleteIfPresent',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'key',
        type: 'address',
      },
    ],
    name: 'delete_unchecked',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: 'epoch',
        type: 'uint256',
      },
    ],
    name: 'getClusters',
    outputs: [
      {
        internalType: 'address[]',
        name: 'clusters',
        type: 'address[]',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getCurrentEpoch',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address[]',
        name: 'newNodes',
        type: 'address[]',
      },
      {
        internalType: 'uint64[]',
        name: 'balances',
        type: 'uint64[]',
      },
    ],
    name: 'insertMultiple_unchecked',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'newNode',
        type: 'address',
      },
      {
        internalType: 'uint64',
        name: 'balance',
        type: 'uint64',
      },
    ],
    name: 'insert_unchecked',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'selectClusters',
    outputs: [
      {
        internalType: 'address[]',
        name: 'nodes',
        type: 'address[]',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: 'numberOfClusters',
        type: 'uint256',
      },
    ],
    name: 'updateNumberOfClustersToSelect',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'cluster',
        type: 'address',
      },
      {
        internalType: 'uint64',
        name: 'clusterBalance',
        type: 'uint64',
      },
    ],
    name: 'update_unchecked',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'newNode',
        type: 'address',
      },
      {
        internalType: 'uint64',
        name: 'balance',
        type: 'uint64',
      },
    ],
    name: 'upsert',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address[]',
        name: 'newNodes',
        type: 'address[]',
      },
      {
        internalType: 'uint64[]',
        name: 'balances',
        type: 'uint64[]',
      },
    ],
    name: 'upsertMultiple',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

export class IClusterSelector__factory {
  static readonly abi = _abi
  static createInterface(): IClusterSelectorInterface {
    return new utils.Interface(_abi) as IClusterSelectorInterface
  }
  static connect(address: string, signerOrProvider: Signer | Provider): IClusterSelector {
    return new Contract(address, _abi, signerOrProvider) as IClusterSelector
  }
}
