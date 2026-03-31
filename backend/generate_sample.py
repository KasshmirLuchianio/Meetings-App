"""Generate a sample Romanian meeting audio for testing."""
import sys
import os

def generate_sample():
    from gtts import gTTS
    
    text = """
    Bună ziua, suntem în ședința de lucru din localitatea Crișan. 
    Astăzi discutăm despre infrastructura locală și proiectele de dezvoltare.
    Domnul Ionescu propune repararea drumului principal care leagă Crișan de Maliuc.
    Termenul limită pentru acest proiect este sfârșitul lunii martie.
    Doamna Popescu menționează necesitatea unui nou centru medical în Crișan.
    Se va face o evaluare a costurilor până la data de 15 aprilie.
    Domnul Vasilescu va contacta Ministerul Mediului pentru finanțare.
    """
    
    output_path = "/tmp/gal_sample_meeting.mp3"
    tts = gTTS(text=text, lang='ro')
    tts.save(output_path)
    print(f"Sample audio saved to {output_path}")
    return output_path

if __name__ == "__main__":
    generate_sample()
