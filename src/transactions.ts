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
  return await clusterRewards['issueTickets(bytes)'](ticketBytes, { ...overrides })
}

export const createUnsignedTransaction = {
  submitTicketForEpochs: async (
    signer: Signer,
    contractAddress: string,
    ticketData: Epoch[],
    maxClustersToUse: number,
    overrides?: Overrides
  ): Promise<PopulatedTransaction> => {
    const ticketBytes = generateTicketBytesForEpochs(ticketData, maxClustersToUse)
    const clusterRewards: ClusterRewards = ClusterRewards__factory.connect(contractAddress, signer)
    return await clusterRewards.populateTransaction['issueTickets(bytes)'](ticketBytes, {
      ...overrides
    })
  }
}
