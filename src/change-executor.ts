import GoogleTranslator from './google-translator';
import { ChangesetItem, ChangesetRemoveOperationItem, ChangesetTranslateOperationItem, TranslationData } from './types';

const PLACEHOLDER_REGEX_PRE = /%{(.*?)}/gi;
const PLACEHOLDER_REGEX_POST = /<span class="notranslate">(.*?)<\/span>/gi;

type Translator = GoogleTranslator;

interface ChangeExecutor {
  translator: Translator;
  logger: (msg: string) => void;
}

class ChangeExecutor {
  constructor(translator: Translator, logger: (msg: string) => void) {
    this.translator = translator;
    this.logger = logger;
  }

  async execute(change: ChangesetItem) {
    switch (change.op) {
    case 'remove':
      await this.executeRemoval(change);
      break;

    case 'translate':
      await this.executeTranslation(change);
      break;
    }
  }

  async executeRemoval(change: ChangesetRemoveOperationItem) {
    // TODO: Move this back out of this class and use a start and finish event instead
    // That way we can switch between showing each and updating a progress bar
    this.logger(`Removing key '${change.path}' from lang '${change.translation.lang}'`);

    let data = change.translation.file.data;
    let path = change.path.split('/').splice(1);

    // Follow the path into the destination translation's data,
    // until we can finally set the translated text.
    path.reduce((current, key, index) => {
      let last = index === path.length - 1;

      if (last) {
        delete current[key];
      } else {
        if (typeof current[key] !== 'object') {
          current[key] = {};
        }
        // We're ensuring this is an object here,
        // but we have to encourage TypeScript to understand the correct type.
        return current[key] as TranslationData;
      }

      // We don't do anything with the final return value, but this makes TypeScript happy.
      return current;
    }, data);
  }

  async executeTranslation(change: ChangesetTranslateOperationItem) {
    // TODO: Move this back out of this class and use a start and finish event instead
    // That way we can switch between showing each and updating a progress bar
    this.logger(`Translating key '${change.path}' to lang '${change.translation.lang}'`);

    let sourceText = change.sourceTranslation;

    const hasPlaceholders = PLACEHOLDER_REGEX_PRE.test(sourceText);

    if (hasPlaceholders) {
      sourceText = sourceText.replace(PLACEHOLDER_REGEX_PRE, '<span class="notranslate">$1</span>');
    }

    let [translatedText] = await this.translator.translate(sourceText, change.translation.lang);

    if (hasPlaceholders) {
      translatedText = translatedText.replace(PLACEHOLDER_REGEX_POST, '{$1}');
    }

    let data = change.translation.file.data;
    let path = change.path.split('/').splice(1);

    // Follow the path into the destination translation's data,
    // until we can finally set the translated text.
    path.reduce((current, key, index) => {
      let last = index === path.length - 1;

      if (last) {
        current[key] = translatedText;
      } else {
        if (typeof current[key] !== 'object') {
          current[key] = {};
        }
        // We're ensuring this is an object here,
        // but we have to encourage TypeScript to understand the correct type.
        return current[key] as TranslationData;
      }

      // We don't do anything with the final return value, but this makes TypeScript happy.
      return current;
    }, data);
  }
}

export default ChangeExecutor;
