import { type UnsignedTransaction, type BigNumberish, BigNumber, type Transaction, type BytesLike, utils } from 'ethers'
import fetch from 'node-fetch'

import { type Epoch } from './types'

const twoE16 = (BigNumber.from(2).pow(16)).sub(1)
const tenE36 = BigNumber.from(10).pow(36)

export async function fetchData (requestData: any): Promise<any> {
  const data = await fetch(requestData.url, { headers: requestData.headers, method: requestData.method, body: requestData.body })
  return data
}

function filterClusterAndTickets (
  _networkId: string,
  _epoch: string,
  allClusters: string[],
  allTickets: string[],
  selectedClusters: string[]
): Epoch {
  const _tickets: string[] = []

  selectedClusters = selectedClusters.map((a) => a.toLowerCase())

  for (let index = 0; index < selectedClusters.length; index++) {
    const cluster = selectedClusters[index]
    const selectedClusterIndex = allClusters.indexOf(cluster)

    let selectedClusterTickets = '0'
    if (selectedClusterIndex !== -1) {
      selectedClusterTickets = allTickets[selectedClusterIndex]
    }

    _tickets.push(selectedClusterTickets)
  }

  return {
    _networkId,
    _epoch,
    _clusters: selectedClusters,
    _tickets
  }
}

export function filterTicketData (epochs: Epoch[], clustersToSelect: string[][]): Epoch[] {
  if (epochs.length !== clustersToSelect.length) {
    throw new Error('Arity mismatch')
  }

  const toReturn: Epoch[] = []
  for (let index = 0; index < epochs.length; index++) {
    const epoch = epochs[index]
    const selectedClusters = clustersToSelect[index]

    toReturn.push(filterClusterAndTickets(epoch._networkId, epoch._epoch, epoch._clusters, epoch._tickets, selectedClusters))
  }

  return toReturn
}

export function increaseGasForTx (
  tx: Transaction,
  gasPrice: BigNumberish,
  gasLimitMultiplier: BigNumberish
): UnsignedTransaction {
  const newGasPrice = BigNumber.from(gasPrice).mul(gasLimitMultiplier).div(100)

  const newTx = {
    nonce: tx.nonce,
    gasPrice: newGasPrice,
    gasLimit: tx.gasLimit,
    to: tx.to,
    value: tx.value,
    data: tx.data
  }

  return newTx
}

export const induceDelay = async (ms: number = 1000): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

export const normalizeTicketData = (epoch: Epoch): Epoch => {
  let total = epoch._tickets.reduce((total, current) => total.add(current), BigNumber.from(0))

  if(total.eq(0)) {
    epoch._tickets = epoch._tickets.map(e => "1");
    total = BigNumber.from(epoch._tickets.length);
  }

  // multiplely the scale by large number and divide at end to reduce the precision loss
  let scale = twoE16.mul(tenE36).div(total)

  const tickets: BigNumber[] = epoch._tickets.map((a) => scale.mul(a)).map((a) => a.div(tenE36))
  const sum = tickets.reduce((prev, current) => prev.add(current), BigNumber.from(0))
  const diff = twoE16.sub(sum)

  tickets[0] = tickets[0].add(diff)

  const updatedSum = tickets.reduce((prev, current) => prev.add(current), BigNumber.from(0))

  if (!updatedSum.eq(twoE16)) {
    throw new Error('Failed ticker normalisation')
  }

  return {
    ...epoch,
    _tickets: tickets.map((a) => a.toString())
  }
}

// assumes that the ticket data is already sorted in asc order of epochs
export const sortAndselectOnlyConsecutiveEpoch = (ticketData: Epoch[]): Epoch[] => {
  if (ticketData.length <= 1) {
    return ticketData
  }
  ticketData = ticketData.sort((a, b) => BigNumber.from(a._epoch).sub(BigNumber.from(b._epoch)).toNumber()) // sort the ticket data in ascending order of epochs

  const startEpoch = ticketData[0]

  const toReturn: Epoch[] = []
  toReturn.push(startEpoch)

  for (let index = 1; index < ticketData.length; index++) {
    const element = ticketData[index]
    const currentEpoch = element._epoch
    const lastEpoch = toReturn[toReturn.length - 1]._epoch

    if (BigNumber.from(lastEpoch).add(1).eq(BigNumber.from(currentEpoch))) {
      toReturn.push(element)
    } else {
      break
    }
  }

  return toReturn
}

export const generateTicketBytesForEpochs = (ticketData: Epoch[], maxClustersToSelect: number): BytesLike => {
  // Ticket Structure
  // |--NetworkId(256 bits)--|--FromEpoch(32 bits)--|--N*Ticket(16 bits)--|
  const networkId = ticketData[0]._networkId
  const startEpoch = BigNumber.from(ticketData[0]._epoch).toNumber()

  let toBytes = networkId + startEpoch.toString(16).padStart(8, '0')

  for(let epochIndex = 0; epochIndex < ticketData.length; epochIndex++) {
    for(let clusterIndex=0; clusterIndex < maxClustersToSelect-1; clusterIndex++) {
      let clusterTicketForEpoch: number = 0;
      if(ticketData[epochIndex]._tickets.length > clusterIndex) clusterTicketForEpoch = parseInt(ticketData[epochIndex]._tickets[clusterIndex]);
      if(clusterTicketForEpoch >= (2**16)) throw new Error("Panic, ticket generation invalid");
      toBytes = toBytes+clusterTicketForEpoch.toString(16).padStart(4, '0');
    }
  }
  console.log(`${(new Date()).toJSON()} Ticket submission data generated is ${toBytes}`)
  return toBytes
}
