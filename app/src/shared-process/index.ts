import * as TokenStore from '../shared-process/token-store'
import { AccountsStore } from './accounts-store'
import { Account } from '../models/account'
import { Database } from './database'
import { RepositoriesStore } from './repositories-store'
import { Repository, IRepository } from '../models/repository'
import { register, broadcastUpdate as broadcastUpdate_ } from './communication'
import {
  IAddRepositoriesAction,
  IUpdateGitHubRepositoryAction,
  IRemoveRepositoriesAction,
  IAddAccountAction,
  IRemoveAccountAction,
  IUpdateRepositoryMissingAction,
  IUpdateRepositoryPathAction,
} from '../lib/dispatcher'
import { API } from '../lib/api'
import { reportError } from '../lib/exception-reporting'
import { getVersion } from '../ui/lib/app-proxy'

import { getLogger } from '../lib/logging/renderer'

process.on('uncaughtException', (error: Error) => {

  getLogger().error('Uncaught exception on shared process', error)

  reportError(error, getVersion())
})

const accountsStore = new AccountsStore(localStorage, TokenStore)
accountsStore.loadFromStore()

const database = new Database('Database')
const repositoriesStore = new RepositoriesStore(database)

const broadcastUpdate = () => broadcastUpdate_(accountsStore, repositoriesStore)

updateAccounts()

async function updateAccounts() {
  await accountsStore.map(async (user: Account) => {
    const api = new API(user)
    const account = await api.fetchAccount()
    const emails = await api.fetchEmails()
    return new Account(account.login, user.endpoint, user.token, emails, account.avatarUrl, account.id, account.name)
  })
  broadcastUpdate()
}

register('console.log', ({ args }: {args: any[]}) => {
  console.log(args[0], ...args.slice(1))
  return Promise.resolve()
})

register('console.error', ({ args }: {args: any[]}) => {
  console.error(args[0], ...args.slice(1))
  return Promise.resolve()
})

register('ping', () => {
  return Promise.resolve('pong')
})

register('get-accounts', () => {
  return Promise.resolve(accountsStore.getAll())
})

register('add-account', async ({ account }: IAddAccountAction) => {
  accountsStore.addAccount(Account.fromJSON(account))
  await updateAccounts()
  return Promise.resolve()
})

register('remove-account', async ({ account }: IRemoveAccountAction) => {
  accountsStore.removeAccount(Account.fromJSON(account))
  broadcastUpdate()
  return Promise.resolve()
})

register('add-repositories', async ({ paths }: IAddRepositoriesAction) => {
  const addedRepos: Repository[] = []
  for (const path of paths) {
    const addedRepo = await repositoriesStore.addRepository(path)
    addedRepos.push(addedRepo)
  }

  broadcastUpdate()
  return addedRepos
})

register('remove-repositories', async ({ repositoryIDs }: IRemoveRepositoriesAction) => {
  const removedRepoIDs: number[] = []
  for (const repoID of repositoryIDs) {
    await repositoriesStore.removeRepository(repoID)
    removedRepoIDs.push(repoID)
  }

  broadcastUpdate()
  return removedRepoIDs
})

register('get-repositories', () => {
  return repositoriesStore.getRepositories()
})

register('update-github-repository', async ({ repository }: IUpdateGitHubRepositoryAction) => {
  const inflatedRepository = Repository.fromJSON(repository as IRepository)
  const updatedRepository = await repositoriesStore.updateGitHubRepository(inflatedRepository)

  broadcastUpdate()

  return updatedRepository
})

register('update-repository-missing', async ({ repository, missing }: IUpdateRepositoryMissingAction) => {
  const inflatedRepository = Repository.fromJSON(repository)
  const updatedRepository = await repositoriesStore.updateRepositoryMissing(inflatedRepository, missing)

  broadcastUpdate()

  return updatedRepository
})

register('update-repository-path', async ({ repository, path }: IUpdateRepositoryPathAction) => {
  const inflatedRepository = Repository.fromJSON(repository)
  const updatedRepository = await repositoriesStore.updateRepositoryPath(inflatedRepository, path)
  const newUpdatedRepository = await repositoriesStore.updateRepositoryMissing(updatedRepository, false)

  broadcastUpdate()

  return newUpdatedRepository
})
