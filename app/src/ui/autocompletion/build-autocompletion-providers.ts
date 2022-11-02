import {
  getNonForkGitHubRepository,
  isRepositoryWithGitHubRepository,
  Repository,
} from '../../models/repository'
import {
  EmojiAutocompletionProvider,
  IAutocompletionProvider,
  UserAutocompletionProvider,
} from '.'
import { Dispatcher } from '../dispatcher'
import { GitHubUserStore } from '../../lib/stores'
import { Account } from '../../models/account'

export function buildAutocompletionProviders(
  repository: Repository,
  dispatcher: Dispatcher,
  emoji: Map<string, string>,
  gitHubUserStore: GitHubUserStore,
  accounts: ReadonlyArray<Account>
): IAutocompletionProvider<any>[] {
  const autocompletionProviders: IAutocompletionProvider<any>[] = [
    new EmojiAutocompletionProvider(emoji),
  ]

  // Issues autocompletion is only available for GitHub repositories.
  const gitHubRepository = isRepositoryWithGitHubRepository(repository)
    ? getNonForkGitHubRepository(repository)
    : null

  if (gitHubRepository !== null) {

    const account = accounts.find(a => a.endpoint === gitHubRepository.endpoint)

    autocompletionProviders.push(
      new UserAutocompletionProvider(gitHubUserStore, gitHubRepository, account)
    )
  }

  return autocompletionProviders
}
