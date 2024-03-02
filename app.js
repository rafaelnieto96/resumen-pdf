const fs = require('fs').promises;
const path = require('path');
const PDFParser = require('pdf-parse');
require('dotenv').config();

const pdfFilePath = 'Fragmentos_de_obras.pdf';
const API_KEY = process.env.API_KEY;
const GMAIL_ADDRESS = process.env.GMAIL_ADDRESS;

async function readPDF(filePath) {
    try {
        const dataBuffer = await fs.readFile(filePath);
        const data = await PDFParser(dataBuffer);

        return data.text;
    } catch (error) {
        throw new Error(`Error al leer el archivo PDF: ${error.message}`);
    }
}

async function splitTextIntoChunks(text, chunkSize, overlap) {
    const words = text.split(/\s+/);
    const chunks = [];
    let i = 0;

    while (i < words.length) {
        const chunk = words.slice(i, i + chunkSize).join(' ');
        if (chunk.trim() !== '') {
            chunks.push(chunk);
        }
        i += chunkSize - overlap;
    }

    return chunks;
}

const generateUUID = () => {
    return Math.random().toString(36).substr(2, 10);
};

async function resumirFragmento(fragmento, fileName) {
    const data = {
        "model": "meta-llama/llama-2-70b-chat",
        "uuid": generateUUID(),
        "message": {
            "role": "user",
            "content": "Quiero que resumas el siguiente texto, dándome el resultado en castellano: " + fragmento
        },
        "temperature": 0.05,
        "origin": "escueladata",
        "tokens": 1000,
        "folder": "root",
        "account": "WatsonX-VN",
        "user": GMAIL_ADDRESS
    };

    const jsonData = JSON.stringify(data);

    try {
        const response = await fetch('https://ia-kong-dev.codingbuddy-4282826dce7d155229a320302e775459-0000.eu-de.containers.appdomain.cloud/api/llm/any-client', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-KEY': API_KEY
            },
            body: jsonData
        });

        const receivedData = await response.json();
        const cleanedData = receivedData.content.replace(/^WX##/, '');
        const resumenPath = path.join(__dirname, 'resumenes', fileName);

        await fs.writeFile(resumenPath, cleanedData + '\n');

        return cleanedData;
    } catch (error) {
        console.error('Error al enviar fragmento:', error);
        throw new Error('Error al enviar fragmento: ' + error.message);
    }
}

async function main() {
    try {
        const pdfText = await readPDF(pdfFilePath);
        const chunkSize = 1000;
        const overlap = 200;
        const textChunks = await splitTextIntoChunks(pdfText, chunkSize, overlap);
        const resumenesFolderPath = path.join(__dirname, 'resumenes');

        try {
            const files = await fs.readdir(resumenesFolderPath);
            for (const file of files) {
                const filePath = path.join(resumenesFolderPath, file);
                await fs.unlink(filePath);
            }
        } catch (error) {
            console.error('Error al eliminar archivos en resúmenes:', error);
            throw new Error('Error al eliminar archivos en resúmenes: ' + error.message);
        }

        let textoCompleto = '';

        for (const chunk of textChunks) {
            const fragmentoResumen = await resumirFragmento(chunk, 'resumen_' + Date.now() + '.txt');
            textoCompleto += fragmentoResumen + '\n';
        }

        await resumirFragmento(textoCompleto, 'resumen_final.txt');
    } catch (error) {
        console.error('Error:', error.message);
        throw new Error('Error: ' + error.message);
    }
}

main();
