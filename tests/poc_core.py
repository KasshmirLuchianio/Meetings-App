"""
GAL MEETINGS - Core POC Test Script
Tests the full chain: Audio → Whisper (Romanian) → Claude (Summary/Actions/Locality) → JSON
"""
import asyncio
import os
import sys
import json
import tempfile

# Add backend to path
sys.path.insert(0, '/app/backend')

from dotenv import load_dotenv
load_dotenv('/app/backend/.env')

API_KEY = os.getenv("EMERGENT_LLM_KEY")
print(f"[INFO] API Key loaded: {'Yes' if API_KEY else 'No'}")

# ========== TEST 1: Generate Romanian Audio Sample ==========
async def test_generate_audio():
    """Generate a Romanian audio sample using gTTS"""
    print("\n" + "="*60)
    print("TEST 1: Generate Romanian Audio Sample")
    print("="*60)
    
    from gtts import gTTS
    
    # Romanian meeting text - simulating a real field meeting
    romanian_text = """
    Bună ziua, suntem în ședința de lucru din localitatea Crișan. 
    Astăzi discutăm despre infrastructura locală și proiectele de dezvoltare.
    
    Domnul Ionescu propune repararea drumului principal care leagă Crișan de Maliuc.
    Termenul limită pentru acest proiect este sfârșitul lunii martie.
    
    Doamna Popescu menționează necesitatea unui nou centru medical în Crișan.
    Se va face o evaluare a costurilor până la data de 15 aprilie.
    
    De asemenea, am discutat despre programul de turism ecologic din Delta Dunării.
    Domnul Vasilescu va contacta Ministerul Mediului pentru finanțare.
    
    Următoarea ședință va fi în localitatea Maliuc, pe data de 20 aprilie.
    Mulțumim tuturor participanților. Ședința s-a încheiat.
    """
    
    audio_path = "/tmp/test_meeting_ro.mp3"
    tts = gTTS(text=romanian_text, lang='ro')
    tts.save(audio_path)
    
    file_size = os.path.getsize(audio_path)
    print(f"[OK] Audio generated: {audio_path} ({file_size} bytes)")
    assert file_size > 0, "Audio file is empty"
    return audio_path

# ========== TEST 2: Whisper Romanian Transcription ==========
async def test_whisper_transcription(audio_path):
    """Test Whisper transcription with Romanian audio"""
    print("\n" + "="*60)
    print("TEST 2: Whisper Romanian Transcription")
    print("="*60)
    
    from emergentintegrations.llm.openai import OpenAISpeechToText
    
    stt = OpenAISpeechToText(api_key=API_KEY)
    
    with open(audio_path, "rb") as audio_file:
        response = await stt.transcribe(
            file=audio_file,
            model="whisper-1",
            response_format="verbose_json",
            language="ro",
            prompt="Aceasta este o ședință de lucru despre proiecte de infrastructură în Delta Dunării.",
            temperature=0.0,
            timestamp_granularities=["segment"]
        )
    
    transcript_text = response.text
    print(f"[OK] Transcript received ({len(transcript_text)} chars)")
    print(f"[TRANSCRIPT]: {transcript_text[:300]}...")
    
    # Check segments if available
    segments = []
    if hasattr(response, 'segments') and response.segments:
        for seg in response.segments[:5]:
            if isinstance(seg, dict):
                segments.append(seg)
            else:
                segments.append({
                    "start": seg.start,
                    "end": seg.end,
                    "text": seg.text
                })
        print(f"[OK] Got {len(response.segments)} segments with timestamps")
    
    assert len(transcript_text) > 50, "Transcript too short"
    assert any(word in transcript_text.lower() for word in ["crișan", "crisan", "ședin", "sedin"]), \
        "Transcript doesn't contain expected Romanian content"
    
    print("[PASS] Whisper transcription works for Romanian!")
    return transcript_text, segments

# ========== TEST 3: Claude Structured JSON Extraction ==========
async def test_claude_extraction(transcript):
    """Test Claude extracting structured JSON from Romanian transcript"""
    print("\n" + "="*60)
    print("TEST 3: Claude Structured JSON Extraction")
    print("="*60)
    
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    
    system_prompt = """Ești un asistent care extrage informații structurate din transcrierile ședințelor în limba română.

REGULI:
- NU inventa informații care nu sunt în transcriere
- Folosește DOAR informațiile din transcriere
- Fii concis și precis
- Răspunde DOAR în limba română
- Returnează DOAR JSON valid, fără alt text

FORMAT OUTPUT (JSON strict):
{
  "title": "Titlul ședinței",
  "locality": "Numele localității principale",
  "summary": ["punct 1", "punct 2", ...],
  "key_points": ["punct cheie 1", "punct cheie 2", ...],
  "actions": [
    {
      "text": "Descrierea acțiunii",
      "owner": "Persoana responsabilă sau null",
      "deadline": "Termenul limită sau null"
    }
  ]
}"""

    chat = LlmChat(
        api_key=API_KEY,
        session_id="poc-test-extraction",
        system_message=system_prompt
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")
    
    user_message = UserMessage(
        text=f"Extrage informațiile structurate din această transcriere de ședință:\n\n{transcript}"
    )
    
    response = await chat.send_message(user_message)
    print(f"[OK] Claude response received ({len(response)} chars)")
    print(f"[RAW RESPONSE]: {response[:500]}")
    
    # Parse JSON - try to extract JSON from response
    try:
        # Try direct parse
        result = json.loads(response)
    except json.JSONDecodeError:
        # Try to extract JSON block
        import re
        json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', response, re.DOTALL)
        if json_match:
            result = json.loads(json_match.group(1))
        else:
            # Try finding the first { ... } block
            start = response.find('{')
            end = response.rfind('}') + 1
            if start >= 0 and end > start:
                result = json.loads(response[start:end])
            else:
                raise ValueError(f"Could not parse JSON from response: {response}")
    
    # Validate structure
    assert "title" in result, "Missing 'title' field"
    assert "locality" in result, "Missing 'locality' field"
    assert "summary" in result and isinstance(result["summary"], list), "Missing/invalid 'summary'"
    assert "key_points" in result and isinstance(result["key_points"], list), "Missing/invalid 'key_points'"
    assert "actions" in result and isinstance(result["actions"], list), "Missing/invalid 'actions'"
    
    print(f"\n[PARSED RESULT]:")
    print(f"  Title: {result['title']}")
    print(f"  Locality: {result['locality']}")
    print(f"  Summary ({len(result['summary'])} items): {result['summary'][:3]}")
    print(f"  Key Points ({len(result['key_points'])} items): {result['key_points'][:3]}")
    print(f"  Actions ({len(result['actions'])} items):")
    for action in result['actions'][:3]:
        print(f"    - {action['text']} (Owner: {action.get('owner', 'N/A')}, Deadline: {action.get('deadline', 'N/A')})")
    
    assert len(result['summary']) > 0, "Summary is empty"
    assert len(result['actions']) > 0, "Actions list is empty"
    
    print("\n[PASS] Claude structured extraction works!")
    return result

# ========== TEST 4: Locality Detection ==========
async def test_locality_detection(transcript):
    """Test locality detection from transcript"""
    print("\n" + "="*60)
    print("TEST 4: Locality Detection")
    print("="*60)
    
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    
    system_prompt = """Extrage numele localității din transcriere.
Dacă apar mai multe localități, alege locația principală a ședinței.
Returnează DOAR numele localității, nimic altceva.
Dacă nu poți identifica o localitate, returnează "Necunoscut"."""

    chat = LlmChat(
        api_key=API_KEY,
        session_id="poc-test-locality",
        system_message=system_prompt
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")
    
    user_message = UserMessage(
        text=f"Transcriere:\n{transcript}"
    )
    
    response = await chat.send_message(user_message)
    locality = response.strip().strip('"').strip("'")
    
    print(f"[OK] Detected locality: '{locality}'")
    assert len(locality) > 0, "Locality is empty"
    assert locality.lower() != "necunoscut", "Could not detect locality"
    
    print("[PASS] Locality detection works!")
    return locality

# ========== MAIN: Run All Tests ==========
async def main():
    print("="*60)
    print("GAL MEETINGS - Core POC Test Suite")
    print("="*60)
    
    results = {
        "audio_generation": False,
        "whisper_transcription": False,
        "claude_extraction": False,
        "locality_detection": False,
        "full_chain": False
    }
    
    try:
        # Test 1: Generate Audio
        audio_path = await test_generate_audio()
        results["audio_generation"] = True
        
        # Test 2: Whisper Transcription
        transcript, segments = await test_whisper_transcription(audio_path)
        results["whisper_transcription"] = True
        
        # Test 3: Claude Extraction
        extraction = await test_claude_extraction(transcript)
        results["claude_extraction"] = True
        
        # Test 4: Locality Detection
        locality = await test_locality_detection(transcript)
        results["locality_detection"] = True
        
        # Full chain success
        results["full_chain"] = True
        
        print("\n" + "="*60)
        print("FULL CHAIN RESULT:")
        print("="*60)
        print(json.dumps({
            "transcript_length": len(transcript),
            "locality": locality,
            "extraction": extraction
        }, indent=2, ensure_ascii=False))
        
    except Exception as e:
        print(f"\n[FAIL] Error: {e}")
        import traceback
        traceback.print_exc()
    
    # Summary
    print("\n" + "="*60)
    print("TEST RESULTS SUMMARY:")
    print("="*60)
    for test_name, passed in results.items():
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"  {status} - {test_name}")
    
    all_passed = all(results.values())
    print(f"\n{'ALL TESTS PASSED!' if all_passed else 'SOME TESTS FAILED!'}")
    return all_passed

if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
