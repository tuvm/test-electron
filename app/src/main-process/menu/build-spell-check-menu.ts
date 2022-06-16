import { app, BrowserWindow, MenuItem } from 'electron'

export async function buildSpellCheckMenu(
  window: BrowserWindow | undefined
): Promise<ReadonlyArray<MenuItem> | undefined> {
  if (window === undefined) {
    return
  }

  /*
    When a user right clicks on a misspelled word in an input, we get event from
    electron. That event comes after the context menu event that we get from the
    dom.
  */
  return new Promise(resolve => {
    window.webContents.once('context-menu', (event, params) =>
      resolve(getSpellCheckMenuItems(event, params, window.webContents))
    )
  })
}

function getSpellCheckMenuItems(
  event: Electron.Event,
  params: Electron.ContextMenuParams,
  webContents: Electron.WebContents
): ReadonlyArray<MenuItem> | undefined {
  const { misspelledWord, dictionarySuggestions } = params
  if (!misspelledWord && dictionarySuggestions.length === 0) {
    return
  }

  const items = new Array<MenuItem>()

  items.push(
    new MenuItem({
      type: 'separator',
    })
  )

  for (const suggestion of dictionarySuggestions) {
    items.push(
      new MenuItem({
        label: suggestion,
        click: () => webContents.replaceMisspelling(suggestion),
      })
    )
  }

  if (misspelledWord) {
    items.push(
      new MenuItem({
        label: __DARWIN__ ? 'Add to Dictionary' : 'Add to dictionary',
        click: () =>
          webContents.session.addWordToSpellCheckerDictionary(misspelledWord),
      })
    )
  }

  if (!__DARWIN__) {
    // NOTE: "On macOS as we use the native APIs there is no way to set the
    // language that the spellchecker uses" -- electron docs Therefore, we are
    // only allowing setting to English for non-mac machines.
    const { session } = webContents
    const spellCheckLanguageItem = getSpellCheckLanguageMenuItemOptions(
      app.getLocale(),
      session.getSpellCheckerLanguages(),
      session.availableSpellCheckerLanguages
    )
    if (spellCheckLanguageItem !== null) {
      items.push(
        new MenuItem({
          label: spellCheckLanguageItem.label,
          click: () =>
            session.setSpellCheckerLanguages(spellCheckLanguageItem.languages),
        })
      )
    }
  }

  return items
}

interface ISpellCheckMenuItemOption {
  /**
   * Dynamic label based on spellchecker's state
   */
  readonly label: string

  /**
   * An array with languages to set spellchecker
   */
  readonly languages: string[]
}

/**
 * Method to get a menu item options to give user the choice to use English or
 * their system language.
 *
 * If system language is english or it's not part of the available languages,
 * it returns null. If spellchecker is not set to english, it returns options
 * that can set it to English. If spellchecker is set to english, it returns
 * the options that can set it to their system language.
 */
export function getSpellCheckLanguageMenuItemOptions(
  userLanguageCode: string,
  spellcheckLanguageCodes: string[],
  availableSpellcheckLanguages: string[]
): ISpellCheckMenuItemOption | null {
  const englishLanguageCode = 'en-US'

  if (
    (userLanguageCode === englishLanguageCode &&
      spellcheckLanguageCodes.includes(englishLanguageCode)) ||
    !availableSpellcheckLanguages.includes(userLanguageCode)
  ) {
    return null
  }

  const languageCode =
    spellcheckLanguageCodes.includes(englishLanguageCode) &&
    !spellcheckLanguageCodes.includes(userLanguageCode)
      ? userLanguageCode
      : englishLanguageCode

  const label =
    languageCode === englishLanguageCode
      ? 'Set spellcheck to English'
      : 'Set spellcheck to system language'

  return {
    label: label,
    languages: [languageCode],
  }
}
