import { utils } from 'ethers'
import { Pool, type PoolClient, type PoolConfig } from 'pg'
import { type Operation, type ClusterQueryData, type Epoch, type EpochData } from './types'

export class DB {
  private ticketClient: PoolClient
  private receiverClient: PoolClient
  private receiver: string
  private readonly ticketPool: Pool
  private readonly receiverPool: Pool
  private readonly epochData: EpochData

  constructor (ticketConfig: PoolConfig, receiverConfig: PoolConfig, epochData: EpochData) {
    this.ticketPool = new Pool(ticketConfig)
    this.receiverPool = new Pool(receiverConfig)
    this.epochData = epochData
  }

  public async init (receiverAddress: string): Promise<void> {
    if (!this.ticketClient) {
      this.ticketClient = await this.ticketPool.connect()
    }

    if (!this.receiverClient) {
      this.receiverClient = await this.receiverPool.connect()
    }

    this.receiver = receiverAddress;
  }

  public async fetchTicketsForEpoch (_networkId: string, _epoch: string, epochEndTime: number): Promise<Epoch> {
    const query = getReceiptQueryString(epochEndTime, this.epochData)
    const result = await this.ticketClient.query(query)

    if (result.rowCount !== result.rows.length) {
      throw new Error('Fetched partial ticket data, need complete ticket data')
    }
    const clusterData = result.rows as ClusterQueryData[]

    return {
      _networkId,
      _epoch,
      _clusters: clusterData.map((a) => a.cluster),
      _tickets: clusterData.map((a) => a.count)
    }
  }

  public async fetchTicketsForEpochs (_networkId: string, _epochs: string[], epochEndTimes: number[]): Promise<Epoch[]> {
    if (_epochs.length !== epochEndTimes.length) {
      throw new Error('Arity mismatch')
    }

    const epochs: Epoch[] = []

    for (let index = 0; index < epochEndTimes.length; index++) {
      const _epoch = _epochs[index]
      const epochEndTime = epochEndTimes[index]
      const query = getReceiptQueryString(epochEndTime, this.epochData)
      const result = await this.ticketClient.query(query)
      const clusterData = result.rows as ClusterQueryData[]

      epochs.push({
        _networkId,
        _epoch,
        _clusters: clusterData.map((a) => a.cluster),
        _tickets: clusterData.map((a) => a.count)
      })
    }

    return epochs
  }

  public async getTimeOfFirstTicket(): Promise<number> {
    const result = await this.ticketClient.query(findTimeOfFirstTicketsQuery());
    const firstTime = result.rows[0];
    if(!firstTime) return 0;
    return 
  } 

  public async savePendingTransaction (operation: number, epoch: number, rawTx: string): Promise<void> {
    const tx = utils.parseTransaction(rawTx)
    await this.receiverClient.query(getInsertString(operation, epoch, tx.hash, rawTx, this.receiver))
  }

  public async deleteOperation (operation: number): Promise<void> {
    await this.receiverClient.query(deleteOperation(operation, this.receiver))
  }

  public async deleteEpoch (epoch: number): Promise<void> {
    await this.receiverClient.query(deleteEpoch(epoch, this.receiver))
  }

  public async getPendingTransaction (): Promise<string | null> {
    const result = await this.getLastOperationData()

    if (result.length > 0) {
      return result[0].data
    } else {
      return null
    }
  }

  public async createRequiredTables (): Promise<void> {
    const combinedTable = createCombinedTable(this.receiver)
    await this.receiverClient.query(combinedTable)
  }

  public async getLastOperationData (): Promise<Operation[]> {
    const lastOperationNumber = await this.getLastOperationNumber()
    const result = await this.receiverClient.query(getLastOperationData(lastOperationNumber, this.receiver))

    return result.rows as Operation[]
  }

  public async getLastOperationNumber (): Promise<number> {
    const result = await this.receiverClient.query(getLastOperationNumberScript(this.receiver))
    if (result.rows.length === 0) {
      return 0
    } else {
      return parseInt(result.rows[0].operation)
    }
  }

  public async updateLatestEpoch (lastSubmittedEpoch: number): Promise<void> {
    await this.receiverClient.query(updateLastSubmitted(lastSubmittedEpoch, this.receiver))
  }

  public async getLastProcessedEpoch (): Promise<number> {
    const lastSubmittedRow = await this.receiverClient.query(getLastSubmittedQuery(this.receiver))
    return lastSubmittedRow.rows[0].lastEpoch;
  }
}

const getReceiptQueryString = (timestamp: number, epochData: EpochData): string => {
  timestamp = Math.floor(timestamp)
  return `
    SELECT rank_filter.cluster, COUNT(*) FROM (
        SELECT msg_recvs.host, msg_recvs.message_id, msg_recvs.cluster, min(msg_recvs.ts) as send_min,
        rank() OVER (
            PARTITION BY (msg_recvs.host, msg_recvs.message_id)
            ORDER BY min(msg_recvs.ts) ASC, min(msg_recvs."offset") ASC
        )
        FROM msg_recvs
        AND msg_recvs.ts > (to_timestamp(${timestamp})) - interval '${epochData.epochLengthInSeconds} seconds'
        AND msg_recvs.ts < (to_timestamp(${timestamp}))
        GROUP BY (msg_recvs.host, msg_recvs.message_id, msg_recvs.cluster)
    ) rank_filter WHERE RANK < 4 AND send_min > (to_timestamp(${timestamp})) - interval '${epochData.epochLengthInSeconds} seconds' AND send_min < (to_timestamp(${timestamp}))  GROUP BY rank_filter.cluster;
    `
}


const findTimeOfFirstTicketsQuery = (): string => {
  return `
    SELECT min(msg_recvs.ts) from msg_recvs
  `
}

const createCombinedTable = (receiver: string): string => {
  return `CREATE TABLE IF NOT EXISTS public.operations_${receiver}
  (
      operation integer NOT NULL,
      epoch integer NOT NULL,
      hash character varying(66) NOT NULL,
      data character varying NOT NULL
  );
  
  ALTER TABLE IF EXISTS public.operations_${receiver}
      OWNER to postgres;
  
  CREATE TABLE IF NOT EXISTS public.lastSubmitted_${receiver}
  (
      index integer NOT NULL,
      lastEpoch integer NOT NULL
      PRIMARY KEY (index)
  );
  
  ALTER TABLE IF EXISTS public.lastSubmitted_${receiver}
      OWNER to postgres;`
}

const getLastOperationData = (operation: number, receiver: string): string => {
  return `SELECT operation, epoch, hash, data FROM public.operations_${receiver} where operation=${operation} order by epoch desc;`
}

const getLastOperationNumberScript = (receiver: string): string => {
  return `SELECT operation, epoch, hash, data FROM public.operations_${receiver} order by operation desc limit 1;`
}

const deleteOperation = (operation: number, receiver: string): string => {
  return `DELETE FROM public.operations_${receiver} WHERE operation = ${operation};`
}

const deleteEpoch = (epoch: number, receiver: string): string => {
  return `DELETE FROM public.operations_${receiver} WHERE epoch = ${epoch};`
}

const updateLastSubmitted = (latestEpoch: number, receiver: string): string => {
  return `INSERT INTO public.lastSubmitted_${receiver} (index, lastEpoch) 
  VALUES (0, ${latestEpoch}) 
  ON CONFLICT (index)
  DO
    UPDATE SET lastEpoch = ${latestEpoch}`;
}

const getLastSubmittedQuery = (receiver: string): string => {
  return `
    SELECT lastEpoch FROM public.lastSubmitted_${receiver} where index=0;
  `;
}

const getInsertString = (operation: number, epoch: number, hash: string, rawTx: string, receiver: string): string => {
  hash = hash.toLowerCase()
  return `INSERT INTO public.operations_${receiver}(
    operation, epoch, hash, data)
    VALUES (${operation}, ${epoch}, '${hash}', '${rawTx}');`
}
