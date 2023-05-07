import { type ClusterRewards } from './generated/ClusterRewards'
import { ClusterRewards__factory } from './generated/factory/ClusterRewards__factory'

import type { BytesLike, ContractTransaction, Overrides, PopulatedTransaction, Signer } from 'ethers'

import { type PromiseOrValue } from './generated/common'
import { type Epoch } from './types'
import { generateTicketBytesForEpochs } from './helper'

export const submitTicketForEpochs = async (
  signer: Signer,
  contractAddress: string,
  ticketBytes: PromiseOrValue<BytesLike>,
  overrides?: Overrides
): Promise<ContractTransaction> => {
  const clusterRewards: ClusterRewards = ClusterRewards__factory.connect(contractAddress, signer)
  const expectedGasLimit = await clusterRewards.estimateGas['issueTickets(bytes)'](ticketBytes)
  if(overrides?.gasLimit) {
    if(overrides.gasLimit instanceof Promise) {
      overrides.gasLimit = await overrides.gasLimit
    }
    if(expectedGasLimit.gt(overrides.gasLimit)) {
      throw new Error(`${(new Date()).toJSON()} Gas limit provided (${overrides.gasLimit}) is less than expected (${expectedGasLimit})`)
    }
  }
  return await clusterRewards['issueTickets(bytes)'](ticketBytes, { ...overrides })
}

export const createUnsignedTransaction = {
  submitTicketForEpochs: async (
    signer: Signer,
    contractAddress: string,
    ticketData: Epoch[],
    maxClustersToSelect: number,
    overrides?: Overrides
  ): Promise<PopulatedTransaction> => {
    const ticketBytes = generateTicketBytesForEpochs(ticketData, maxClustersToSelect)
    const clusterRewards: ClusterRewards = ClusterRewards__factory.connect(contractAddress, signer)
    const expectedGasLimit = await clusterRewards.estimateGas['issueTickets(bytes)'](ticketBytes)
    if(overrides?.gasLimit) {
      if(overrides.gasLimit instanceof Promise) {
        overrides.gasLimit = await overrides.gasLimit
      }
      if(expectedGasLimit.gt(overrides.gasLimit)) {
        throw new Error(`${(new Date()).toJSON()} Gas limit provided (${overrides.gasLimit}) is less than expected (${expectedGasLimit})`)
      }
    }
    return await clusterRewards.populateTransaction['issueTickets(bytes)'](ticketBytes, {
      ...overrides
    })
  },
  submitTicketForAdhocEpochs: async (
    signer: Signer,
    contractAddress: string,
    ticketData: Epoch[],
    overrides?: Overrides
  ): Promise<PopulatedTransaction> => {
    const networkId = ticketData[0].networkId;
    const epochs = ticketData.map(e => e.epoch);
    const tickets = ticketData.map(e => e.tickets);
    const clusterRewards: ClusterRewards = ClusterRewards__factory.connect(contractAddress, signer)
    const expectedGasLimit = await clusterRewards.estimateGas['issueTickets(bytes32,uint24[],uint16[][])'](networkId, epochs, tickets)
    if(overrides?.gasLimit) {
      if(overrides.gasLimit instanceof Promise) {
        overrides.gasLimit = await overrides.gasLimit
      }
      if(expectedGasLimit.gt(overrides.gasLimit)) {
        throw new Error(`${(new Date()).toJSON()} Gas limit provided (${overrides.gasLimit}) is less than expected (${expectedGasLimit})`)
      }
    }
    return await clusterRewards.populateTransaction['issueTickets(bytes32,uint24[],uint16[][])'](networkId, epochs, tickets, {
      ...overrides
    })
  }
}