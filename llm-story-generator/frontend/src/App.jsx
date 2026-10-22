import { useState } from "react";
import { generateStory, talkToCharacter } from "./services/api";
import PromptForm from "./components/PromptForm";
import StoryViewer from "./components/StoryViewer";
import CharacterManager from "./components/CharacterManager";
import StoryManager from "./components/StoryManager";

function App() {
  const [prompt, setPrompt] = useState("");
  const [storyGenre, setStoryGenre] = useState("fantasy");
  const [characterName, setCharacterName] = useState("Mysterious Wanderer");
  const [selectedCharacterId, setSelectedCharacterId] = useState("");
  const [models, setModels] = useState([]);
  const [primaryModel, setPrimaryModel] = useState("");
  const [storyOutputs, setStoryOutputs] = useState([]);
  const [characterOutput, setCharacterOutput] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [draftText, setDraftText] = useState("");
  const [currentStoryId, setCurrentStoryId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGenerateStory = async (storyId) => {
    setError("");
    setStoryOutputs([]);
    setLoading(true);

    try {
      const requestedModels = models.length > 0 ? models : primaryModel ? [primaryModel] : ["llama-3"];
      const result = await generateStory({ prompt, models: requestedModels, genre: storyGenre, draftText, storyId, useMcp: true });
      if (result.errors?.length) {
        setError(result.errors.map((item) => `${item.model}: ${item.error}`).join("\n"));
      }
      setStoryOutputs(result.outputs || []);
      setCurrentStoryId(storyId || "");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTalkToCharacter = async () => {
    setError("");
    setCharacterOutput("");
    setLoading(true);

    try {
      const result = await talkToCharacter({ sessionId, characterId: selectedCharacterId, characterName, prompt });
      setCharacterOutput(result.output);
      setSessionId(result.sessionId);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadDraft = (text, storyId, genre) => {
    setDraftText(text || "");
    if (storyId) setCurrentStoryId(storyId);
    if (genre) setStoryGenre(genre);
  };

  const handleRegenerateStory = async (storyId) => {
    await handleGenerateStory(storyId);
  };

  return (
    <div className="app-shell">
      <header>
        <h1>LLM Story Generator</h1>
        <p>Enter a prompt, choose model themes, and keep story context alive across generations.</p>
      </header>

      <PromptForm
        prompt={prompt}
        setPrompt={setPrompt}
        storyGenre={storyGenre}
        setStoryGenre={setStoryGenre}
        characterName={characterName}
        setCharacterName={setCharacterName}
        models={models}
        setModels={setModels}
        primaryModel={primaryModel}
        setPrimaryModel={setPrimaryModel}
        onGenerateStory={() => handleGenerateStory(currentStoryId)}
        onTalkToCharacter={handleTalkToCharacter}
        loading={loading}
      />

      <CharacterManager onSelect={(id)=>setSelectedCharacterId(id)} onDraftUpload={(text)=>setDraftText(text)} />

      <StoryManager
        currentOutputs={storyOutputs}
        draftText={draftText}
        storyGenre={storyGenre}
        selectedCharacterId={selectedCharacterId}
        onLoadDraft={handleLoadDraft}
        onRegenerateStory={handleRegenerateStory}
      />

      {error && <div className="alert error">{error}</div>}

      <StoryViewer storyOutputs={storyOutputs} characterOutput={characterOutput} />

      <footer>
        <small>Character session ID: {sessionId || "not started"}</small>
      </footer>
    </div>
  );
}

export default App;
