/**
 * Parse an .xcstrings file content
 * @param {string} content - The JSON content of the .xcstrings file
 * @returns {object} - Parsed xcstrings data
 */
export function parseXCStrings(content) {
  try {
    const data = JSON.parse(content)

    // Validate basic structure
    if (!data.sourceLanguage) {
      data.sourceLanguage = 'en'
    }

    if (!data.strings) {
      data.strings = {}
    }

    if (!data.version) {
      data.version = '1.0'
    }

    return data
  } catch (error) {
    throw new Error(`Failed to parse .xcstrings file: ${error.message}`)
  }
}

/**
 * Generate .xcstrings file content from data
 * @param {object} data - The xcstrings data object
 * @returns {string} - JSON string ready to save
 */
export function generateXCStrings(data) {
  // Sort keys for consistent output
  const sortedData = {
    sourceLanguage: data.sourceLanguage || 'en',
    version: data.version || '1.0',
    strings: {}
  }

  // Sort string keys alphabetically
  const sortedKeys = Object.keys(data.strings || {}).sort()

  for (const key of sortedKeys) {
    const value = data.strings[key]
    sortedData.strings[key] = value

    // Sort localizations if present
    if (value.localizations) {
      const sortedLocalizations = {}
      const locKeys = Object.keys(value.localizations).sort()
      for (const locKey of locKeys) {
        sortedLocalizations[locKey] = value.localizations[locKey]
      }
      sortedData.strings[key].localizations = sortedLocalizations
    }
  }

  return JSON.stringify(sortedData, null, 2)
}

/**
 * Get statistics about the xcstrings file
 * @param {object} data - The xcstrings data object
 * @param {string[]} targetLanguages - Optional list of target languages to check
 * @returns {object} - Statistics about the file
 */
export function getTranslationStats(data, targetLanguages = []) {
  const strings = data.strings || {}
  const keys = Object.keys(strings)

  // Collect all languages
  const languagesSet = new Set()

  for (const key of keys) {
    const localizations = strings[key]?.localizations || {}
    for (const lang of Object.keys(localizations)) {
      languagesSet.add(lang)
    }
  }

  const languages = Array.from(languagesSet).sort()

  // Count translations per language
  const translationCounts = {}
  const missingCounts = {}

  for (const lang of languages) {
    translationCounts[lang] = 0
    missingCounts[lang] = 0
    for (const key of keys) {
      if (strings[key]?.localizations?.[lang]?.stringUnit?.value) {
        translationCounts[lang]++
      } else {
        missingCounts[lang]++
      }
    }
  }

  // Also calculate for target languages not yet in the file
  for (const lang of targetLanguages) {
    if (!languages.includes(lang)) {
      translationCounts[lang] = 0
      missingCounts[lang] = keys.length
    }
  }

  return {
    totalStrings: keys.length,
    languages,
    translationCounts,
    missingCounts,
    sourceLanguage: data.sourceLanguage || 'en'
  }
}

/**
 * Get missing translations for specified languages
 * @param {object} data - The xcstrings data object
 * @param {string[]} targetLanguages - Languages to check
 * @returns {object} - Object with keys and their missing languages
 */
export function getMissingTranslations(data, targetLanguages) {
  const strings = data.strings || {}
  const missing = {}

  for (const [key, value] of Object.entries(strings)) {
    const localizations = value?.localizations || {}
    const missingLangs = targetLanguages.filter(lang => !localizations[lang])

    if (missingLangs.length > 0) {
      const englishText = localizations.en?.stringUnit?.value || key
      missing[key] = {
        englishText,
        missingLanguages: missingLangs
      }
    }
  }

  return missing
}

/**
 * Add a translation to the data
 * @param {object} data - The xcstrings data object
 * @param {string} key - The string key
 * @param {string} language - The language code
 * @param {string} translation - The translated text
 * @returns {object} - Updated data object
 */
export function addTranslation(data, key, language, translation) {
  if (!data.strings[key]) {
    data.strings[key] = {}
  }

  if (!data.strings[key].localizations) {
    data.strings[key].localizations = {}
  }

  data.strings[key].localizations[language] = {
    stringUnit: {
      state: 'translated',
      value: translation
    }
  }

  return data
}
