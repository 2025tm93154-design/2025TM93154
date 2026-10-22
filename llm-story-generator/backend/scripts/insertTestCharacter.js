import { upsertCharacter, listCharacters } from '../db.js';

async function run() {
  const profile = {
    id: 'test-hero',
    name: 'Test Hero',
    role: 'Protagonist',
    classification: 'lead',
    short_bio: 'A brave test character used for local testing.',
    personality_traits: ['brave', 'curious'],
    motivations: ['discover truth'],
    speaking_style: 'concise',
    example_first_paragraph: 'It was a testy morning.'
  };

  upsertCharacter({ id: profile.id, name: profile.name, classification: profile.classification, genre: 'fantasy', model: 'local-mock', profile });
  console.log('Inserted test character. Current characters:');
  console.log(listCharacters());
}

run().catch(e=>{ console.error(e); process.exit(1); });
