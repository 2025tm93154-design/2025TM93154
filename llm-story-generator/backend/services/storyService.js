function buildStoryPrompt({ prompt, genre = 'general', draftText = '', previousStory = '' }) {
  const pieces = [
    `Write a ${genre} story using the prompt below.`,
    `Keep the output fresh, avoid repeating exact sentences or phrases from the draft or prior story, and preserve continuity while improving clarity and pacing.`
  ];

  if (draftText) {
    pieces.push(`Draft text:
${draftText}`);
  }

  if (previousStory) {
    pieces.push(`Previous story content:
${previousStory}`);
  }

  pieces.push(`Story prompt:
${prompt}`);
  pieces.push(`If this is a regeneration, revise and build upon the previous story rather than repeating it.`);
  pieces.push(`Return the complete story in one coherent response.`);

  return pieces.join("\n\n");
}

function buildStoryMessages({ prompt, genre, draftText = '', previousStory = '' }) {
  return [
    {
      role: 'system',
      content: `You are a creative story engine. Write a ${genre} story. Avoid repetition, preserve narrative continuity, and keep the writing vivid.`
    },
    {
      role: 'user',
      content: buildStoryPrompt({ prompt, genre, draftText, previousStory })
    }
  ];
}

export { buildStoryPrompt, buildStoryMessages };