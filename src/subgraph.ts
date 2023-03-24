import { fetchData } from './helper'
import { BigNumber } from 'ethers'
export class Subgraph {
  private readonly url: string
  private readonly countPerQuery: number = BigNumber.from(process.env.MAX_OBJECTS_PER_SUBGRAPH_QUERY || 999).toNumber()

  constructor (url: string) {
    this.url = url
  }

  private epochsString (epochs: string[]): string {
    if (epochs.length === 0) {
      return '[0]'
    } else {
      const numEpochs = epochs.map((a) => parseInt(a))
      return `[${numEpochs.toString()}]`
    }
  }

  public async getClustersSelectedAfterGivenEpoch (epochs: string): Promise<any[]> {
    let skip = 0
    const allData = []
    for (;;) {
      const data = JSON.stringify({
        query: `{
            selectedClusters(first: ${this.countPerQuery}, skip:${
          skip * this.countPerQuery
        }, orderBy: epoch ,orderDirection: asc, where:{epoch_gt:${epochs}}){
              id
              address
              epoch
              network { id }
            }
          }`
      })

      const options = {
        url: this.url,
        method: 'post',
        headers: { 'Content-Type': 'application/json' },
        body: data
      }

      const result = await (await fetchData(options)).json()
      if (result.errors) {
        throw new Error('Error while fetching data from subgraph')
      } else if (result.data.selectedClusters.length === 0) {
        return allData
      } else {
        skip++
        allData.push(...result.data.selectedClusters)
      }
    }
  }

  public async getAllClustersSelectedInGivenEpochs (epochs: string[]): Promise<any[]> {
    let skip = 0
    const allData = []
    for (;;) {
      const data = JSON.stringify({
        query: `{
            selectedClusters(first: ${this.countPerQuery}, skip:${
          skip * this.countPerQuery
        }, orderBy: epoch ,orderDirection: asc, where:{epoch_not_in:${this.epochsString(epochs)}}){
              id
              address
              epoch
              network { id }
            }
          }`
      })

      const options = {
        url: this.url,
        method: 'post',
        headers: { 'Content-Type': 'application/json' },
        body: data
      }

      const result = await (await fetchData(options)).json()
      if (result.errors) {
        throw new Error('Error while fetching data from subgraph')
      } else if (result.data.selectedClusters.length === 0) {
        return allData
      } else {
        skip++
        allData.push(...result.data.selectedClusters)
      }
    }
  }

  public async getLastSubmittedEpochForGivenAddress (address: string): Promise<any[]> {
    address = address.toLowerCase()
    const allData = []

    const data = JSON.stringify({
      query: `{
        selectedClusters(first: 1, orderBy: epoch, orderDirection:desc, where:{address: "${address}"}) {
          id
          address
          epoch
          network { id }
        }
      }`
    })

    const options = {
      url: this.url,
      method: 'post',
      headers: { 'Content-Type': 'application/json' },
      body: data
    }

    const result = await (await fetchData(options)).json()
    if (result.errors) {
      throw new Error('Error while fetching data from subgraph')
    } else {
      allData.push(...result.data.selectedClusters)
      return allData
    }
  }

  public async getConfigData (): Promise<any> {
    const data = JSON.stringify({
      query: `{
        contractStores{
          id
          address
        }
        params {
          id
          value
        }
        selectors {
          id
          networkId
        }
      }`
    })

    const options = {
      url: this.url,
      method: 'post',
      headers: { 'Content-Type': 'application/json' },
      body: data
    }

    const result = await (await fetchData(options)).json()
    if (result.errors) {
      throw new Error('Error while fetching data from subgraph')
    } else {
      return result.data
    }
  }
}
