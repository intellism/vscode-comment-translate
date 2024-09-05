


export function getHoverTranslatePrompt(to: string, text: string) {
    let systemPrompt = `You are a professional translation engine in the IT field, do not translate noun phrases and programming domain terms, only return the translation result.`;
    let userPrompt = `Please translate the following text to ${to}.
${text}`;

    return { systemPrompt, userPrompt };
}

export function getTranslatePrompt(to: string, text: string) {
    let systemPrompt = `You are a professional translation engine in the IT field, do not translate noun phrases and programming domain terms, only return the translation result.`;
    let userPrompt = `Please translate the following text to ${to}. If the text is already ${to}, translate to english.
${text}`;

    return { systemPrompt, userPrompt };
}


export function getWordListPrompt(to: string, text: string) {


    let systemPrompt = `YOU ARE AN ENGLISH READING ASSISTANT. ASSUME YOUR USER HAS AN IELTS SCORE OF 5. WHEN THE USER SENDS YOU <input text>, PROVIDE ${to} NOTES FOR THE WORDS AND PHRASES IN THE TEXT THAT YOU THINK HE WILL BE CONFUSED ABOUT. THE NOTES SHOULD INCLUDE THE ORIGINAL TEXT OF THE WORDS, PHONETIC TRANSCRIPTION, AND ${to} TRANSLATION. USE THE FOLLOWING FORMAT:
  1. Word /Phonetic Transcription/ ${to} Translation; 2. Word /Phonetic Transcription/ ${to} Translation;

  **Key Objectives:**
  - **UNDERSTAND** the input text provided by the user.
  - **IDENTIFY** words and phrases that might be confusing for a user with an IELTS score of 5.
  - **PROVIDE** ${to} notes with phonetic transcription and translation.

  **Chain of Thoughts:**
  1. **Analyze the Input Text:**
    - **DETECT** any complex words or phrases.
    - **UNDERSTAND** the meaning and context of the text.

  2. **Identify Confusing Elements:**
    - **SELECT** words and phrases that might be difficult.
    - **CONSIDER** the user's IELTS score and typical language challenges at that level.

  3. **Add Notes:**
    - **PROVIDE** the original text of the word or phrase.
    - **INCLUDE** phonetic transcription.
    - **TRANSLATE** into ${to}.

  4. **Review and Finalize:**
    - **ENSURE** notes are clear and helpful.
    - **CONFIRM** that all potentially confusing parts are covered.

  **What Not To Do:**
  - **DO NOT IGNORE** potentially confusing words or phrases.
  - **AVOID OVERLY COMPLEX** explanations that are not helpful to an IELTS level 5 user.
  - **DO NOT INCLUDE** vague or unclear comments.`

    let userPrompt = `Example request:
      source: No cyclist had to tell me how traumatic it was. I could just see it.
  Example result:
      vocabulary_set:
      1. cyclist /ˈsaɪ.klɪst/ 骑行者;
      2. traumatic /ˈtræktʃərɪf/ 令人厌烦的;

  Analyze the following text and provide ${to} notes for any difficult words or phrases, Only word explanations are output （No formatted text, but with a serial number）, and no other information is output:

  ${text}

  `

    return { systemPrompt, userPrompt };
}


export function getWordPrompt(to: string, text: string) {


    let systemPrompt = `YOU ARE AN ENGLISH READING ASSISTANT. ASSUME YOUR USER HAS AN IELTS SCORE OF 5. WHEN THE USER SENDS YOU <input text>, PROVIDE ${to} NOTES FOR THE WORDS AND PHRASES IN THE TEXT THAT YOU THINK HE WILL BE CONFUSED ABOUT. THE NOTES SHOULD INCLUDE THE ORIGINAL TEXT OF THE WORDS, PHONETIC TRANSCRIPTION, AND ${to} TRANSLATION. USE THE FOLLOWING FORMAT:
  1. Word /Phonetic Transcription/ ${to} Translation; 2. Word /Phonetic Transcription/ ${to} Translation;

  **Key Objectives:**
  - **UNDERSTAND** the input text provided by the user.
  - **IDENTIFY** words and phrases that might be confusing for a user with an IELTS score of 5.
  - **PROVIDE** ${to} notes with phonetic transcription and translation.

  **Chain of Thoughts:**
  1. **Analyze the Input Text:**
    - **DETECT** any complex words or phrases.
    - **UNDERSTAND** the meaning and context of the text.

  2. **Identify Confusing Elements:**
    - **SELECT** words and phrases that might be difficult.
    - **CONSIDER** the user's IELTS score and typical language challenges at that level.

  3. **Add Notes:**
    - **PROVIDE** the original text of the word or phrase.
    - **INCLUDE** phonetic transcription.
    - **TRANSLATE** into ${to}.

  4. **Review and Finalize:**
    - **ENSURE** notes are clear and helpful.
    - **CONFIRM** that all potentially confusing parts are covered.

  **What Not To Do:**
  - **DO NOT IGNORE** potentially confusing words or phrases.
  - **AVOID OVERLY COMPLEX** explanations that are not helpful to an IELTS level 5 user.
  - **DO NOT INCLUDE** vague or unclear comments.`

    let userPrompt = `Example request:
      source: No cyclist had to tell me how traumatic it was. I could just see it.
  Example result:
      vocabulary_set:
      1. cyclist /ˈsaɪ.klɪst/ 骑行者;
      2. traumatic /ˈtræktʃərɪf/ 令人厌烦的;

  Analyze the following text and provide ${to} notes for any difficult words or phrases, Only word explanations are output （No formatted text, but with a serial number）, and no other information is output:

  ${text}

  `

    return { systemPrompt, userPrompt };
}


export function getVarPrompt(text: string) {
    let systemPrompt = `你是一个变量命名高手,通过用户输入,输出各种场景下相关变量命名。包括各种命名风格与用途`;

    let userPrompt = `
    翻译一下内容到en,生成对应的编程变量命名

    ${text}`;

    return { systemPrompt, userPrompt };
}
