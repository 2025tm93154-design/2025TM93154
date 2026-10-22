import { useEffect, useState } from "react";
import { createCharacter, listCharacters, uploadDraft, deleteCharacterApi } from "../services/api";

function CharacterManager({ onSelect, onDraftUpload }) {
  const [name, setName] = useState("");
  const [classification, setClassification] = useState("protagonist");
  const [characters, setCharacters] = useState([]);
  const [file, setFile] = useState(null);

  const load = async () => {
    try {
      const res = await listCharacters();
      setCharacters(res.characters || []);
    } catch (e) {}
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    const profile = await createCharacter({ name, classification });
    setName("");
    load();
    if (onSelect) onSelect(profile.profile.id);
  };

  const handleUpload = async () => {
    if (!file) return;
    const res = await uploadDraft(file);
    alert('Draft uploaded, extracted ' + (res.text || '').slice(0,200) + '...');
    if (res.text && onDraftUpload) onDraftUpload(res.text);
  };

  return (
    <section className="prompt-panel">
      <h3>Character Manager</h3>
      <label>
        Name
        <input value={name} onChange={(e)=>setName(e.target.value)} />
      </label>
      <label>
        Classification
        <select value={classification} onChange={(e)=>setClassification(e.target.value)}>
          <option>protagonist</option>
          <option>antagonist</option>
          <option>deutrogenist</option>
          <option>supporting</option>
        </select>
      </label>
      <div className="button-row">
        <button onClick={handleCreate} disabled={!name}>Create Character</button>
      </div>

      <h4>Existing Characters</h4>
      <ul>
        {characters.map(c => (
          <li key={c.id}>
            <strong>{c.name}</strong> — {c.classification}
            <div className="button-row">
              <button onClick={()=>onSelect(c.id)}>Select</button>
              <button onClick={async ()=>{ if(!confirm('Delete character?')) return; await deleteCharacterApi(c.id); load(); }}>Delete</button>
            </div>
          </li>
        ))}
      </ul>

      <h4>Attach Draft</h4>
      <input type="file" accept=".pdf,.docx,.txt" onChange={(e)=>setFile(e.target.files[0])} />
      <div className="button-row"><button onClick={handleUpload} disabled={!file}>Upload Draft</button></div>
    </section>
  );
}

export default CharacterManager;
