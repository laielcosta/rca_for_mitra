/*
DETECTOR UNIVERSAL DE SELECTORES
Funciona en CUALQUIER página web que esté abierta en el navegador
Se actualiza en tiempo real cuando navegas
*/

const puppeteer = require('puppeteer');
const fs = require('fs');

function delay(ms) {
    return new Promise(res => setTimeout(res, ms));
}

// Función para extraer selectores de una página/frame
async function extractSelectors(frameOrPage, name) {
    try {
        const selectors = await frameOrPage.evaluate(() => {
            const result = {
                url: window.location.href,
                title: document.title,
                selects: [],
                buttons: [],
                inputs: [],
                links: [],
                tabs: []
            };
            
            // SELECTS
            document.querySelectorAll('select').forEach(sel => {
                const options = Array.from(sel.options).map(opt => ({
                    value: opt.value,
                    text: opt.textContent.trim()
                }));
                
                result.selects.push({
                    id: sel.id || null,
                    name: sel.name || null,
                    class: sel.className || null,
                    options: options,
                    selector: sel.id ? `#${sel.id}` : (sel.name ? `select[name="${sel.name}"]` : null)
                });
            });
            
            // BUTTONS
            document.querySelectorAll('button, input[type="button"], input[type="submit"]').forEach(btn => {
                result.buttons.push({
                    id: btn.id || null,
                    name: btn.name || null,
                    value: btn.value || null,
                    text: btn.textContent?.trim() || btn.value || null,
                    selector: btn.id ? `#${btn.id}` : (btn.value ? `input[value="${btn.value}"]` : null)
                });
            });
            
            // INPUTS (text, number, radio, checkbox, etc.)
            document.querySelectorAll('input').forEach(inp => {
                result.inputs.push({
                    type: inp.type,
                    id: inp.id || null,
                    name: inp.name || null,
                    value: inp.value || null,
                    class: inp.className || null,
                    selector: inp.id ? `#${inp.id}` : (inp.name ? `input[name="${inp.name}"]` : null)
                });
            });
            
            // LINKS/TABS (a, li con onclick, etc.)
            document.querySelectorAll('a, li[onclick], div[onclick]').forEach(link => {
                const text = link.textContent?.trim();
                if (text && text.length > 0 && text.length < 100) {
                    result.links.push({
                        tag: link.tagName,
                        href: link.getAttribute('href') || null,
                        onclick: link.getAttribute('onclick') || null,
                        text: text,
                        id: link.id || null,
                        class: link.className || null
                    });
                }
            });
            
            // TABS específicas (pestañas de configuración)
            document.querySelectorAll('[role="tab"], .tab, li.tab, a.tab, button.tab').forEach(tab => {
                result.tabs.push({
                    text: tab.textContent?.trim(),
                    id: tab.id || null,
                    class: tab.className || null,
                    selector: tab.id ? `#${tab.id}` : null
                });
            });
            
            return result;
        });
        
        return { name, ...selectors };
    } catch (error) {
        console.error(`Error extrayendo selectores de ${name}:`, error.message);
        return null;
    }
}

// Función para mostrar resumen en consola
function printSummary(data) {
    console.log('\n' + '='.repeat(70));
    console.log(`📄 ${data.name}`);
    console.log(`🌐 URL: ${data.url}`);
    console.log(`📌 Título: ${data.title}`);
    console.log('='.repeat(70));
    
    if (data.selects.length > 0) {
        console.log('\n🔽 SELECTORES <select>:');
        data.selects.forEach((sel, idx) => {
            const selector = sel.selector || `select (sin id/name)`;
            console.log(`  ${idx + 1}. ${selector}`);
            console.log(`     ID: ${sel.id || 'N/A'} | Name: ${sel.name || 'N/A'} | Class: ${sel.class || 'N/A'}`);
            if (sel.options.length > 0) {
                const preview = sel.options.slice(0, 5).map(o => o.text).join(', ');
                console.log(`     Opciones (${sel.options.length}): ${preview}${sel.options.length > 5 ? '...' : ''}`);
            }
        });
    }
    
    if (data.buttons.length > 0) {
        console.log('\n🔘 BOTONES:');
        data.buttons.forEach((btn, idx) => {
            if (btn.value || btn.text) {
                console.log(`  ${idx + 1}. ${btn.selector || 'button'}`);
                console.log(`     Texto/Value: "${btn.text || btn.value}"`);
            }
        });
    }
    
    if (data.inputs.length > 0) {
        console.log('\n📝 INPUTS:');
        const importantInputs = data.inputs.filter(i => 
            i.type !== 'hidden' && (i.id || i.name)
        );
        importantInputs.slice(0, 10).forEach((inp, idx) => {
            console.log(`  ${idx + 1}. ${inp.selector || `input[type="${inp.type}"]`}`);
            console.log(`     Type: ${inp.type} | Value: "${inp.value || 'N/A'}"`);
        });
        if (importantInputs.length > 10) {
            console.log(`  ... y ${importantInputs.length - 10} inputs más`);
        }
    }
    
    if (data.tabs.length > 0) {
        console.log('\n📑 PESTAÑAS/TABS:');
        data.tabs.forEach((tab, idx) => {
            console.log(`  ${idx + 1}. "${tab.text}"`);
            console.log(`     Selector: ${tab.selector || tab.class}`);
        });
    }
    
    if (data.links.length > 0) {
        console.log('\n🔗 LINKS IMPORTANTES:');
        const importantLinks = data.links.filter(l => 
            l.text && (
                l.text.toLowerCase().includes('wifi') ||
                l.text.toLowerCase().includes('wireless') ||
                l.text.toLowerCase().includes('advanced') ||
                l.text.toLowerCase().includes('general') ||
                l.text.toLowerCase().includes('wps') ||
                l.text.toLowerCase().includes('mac') ||
                l.text.toLowerCase().includes('security') ||
                l.text.includes('2.4') ||
                l.text.includes('5G')
            )
        );
        importantLinks.slice(0, 15).forEach((link, idx) => {
            console.log(`  ${idx + 1}. "${link.text}"`);
            if (link.href) console.log(`     href: ${link.href}`);
            if (link.onclick) console.log(`     onclick: ${link.onclick.substring(0, 50)}...`);
        });
    }
}

(async () => {
    let browser;
    
    try {
        console.log('╔════════════════════════════════════════════════════════════════╗');
        console.log('║         DETECTOR UNIVERSAL DE SELECTORES                       ║');
        console.log('║         Detecta selectores en cualquier página web             ║');
        console.log('╚════════════════════════════════════════════════════════════════╝\n');
        
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        // Preguntar URL inicial
        const url = await new Promise(resolve => {
            rl.question('🌐 Ingresa la URL inicial (o Enter para http://192.168.1.1): ', answer => {
                resolve(answer.trim() || 'http://192.168.1.1');
            });
        });
        
        console.log('\n🚀 Iniciando navegador...');
        browser = await puppeteer.launch({
            headless: false,
            defaultViewport: { width: 1366, height: 768 },
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        
        console.log(`📍 Navegando a ${url}...`);
        await page.goto(url, { waitUntil: "networkidle2" });
        await delay(2000);
        
        let allData = [];
        let counter = 1;
        
        // BUCLE PRINCIPAL - Detectar selectores cada vez que el usuario presiona ENTER
        while (true) {
            console.log('\n' + '▓'.repeat(70));
            console.log(`🔍 DETECCIÓN #${counter}`);
            console.log('▓'.repeat(70));
            
            // Detectar en página principal
            console.log('\n📄 Analizando página principal...');
            const mainData = await extractSelectors(page, 'Página Principal');
            if (mainData) {
                printSummary(mainData);
                allData.push({ timestamp: new Date().toISOString(), ...mainData });
            }
            
            // Detectar en todos los frames
            const frames = page.frames();
            if (frames.length > 1) {
                console.log(`\n📦 Detectados ${frames.length} frames, analizando...`);
                
                for (let i = 1; i < frames.length; i++) {
                    const frame = frames[i];
                    if (frame.url() === 'about:blank') continue;
                    
                    console.log(`\n📦 Frame ${i}:`);
                    const frameData = await extractSelectors(frame, `Frame ${i} (${frame.name() || 'sin nombre'})`);
                    if (frameData && (frameData.selects.length > 0 || frameData.buttons.length > 0)) {
                        printSummary(frameData);
                        allData.push({ timestamp: new Date().toISOString(), ...frameData });
                    }
                }
            }
            
            // Guardar en archivo
            const filename = `selectores_deteccion_${counter}.json`;
            fs.writeFileSync(filename, JSON.stringify(allData, null, 2));
            console.log(`\n💾 Datos guardados en: ${filename}`);
            
            // Esperar input del usuario
            console.log('\n' + '─'.repeat(70));
            console.log('📌 OPCIONES:');
            console.log('   • Presiona ENTER → Detectar selectores de la página actual');
            console.log('   • Escribe "quit" → Salir del programa');
            console.log('   • Navega manualmente en el navegador a otra página');
            console.log('─'.repeat(70));
            
            const input = await new Promise(resolve => {
                rl.question('\n👉 ', answer => {
                    resolve(answer.trim().toLowerCase());
                });
            });
            
            if (input === 'quit' || input === 'q' || input === 'exit') {
                console.log('\n✅ Saliendo...');
                break;
            }
            
            counter++;
            await delay(500);
        }
        
        rl.close();
        
        // Crear resumen final
        console.log('\n╔════════════════════════════════════════════════════════════════╗');
        console.log('║                    RESUMEN FINAL                               ║');
        console.log('╚════════════════════════════════════════════════════════════════╝');
        console.log(`\n✅ Total de detecciones: ${counter - 1}`);
        console.log(`💾 Archivo final: selectores_deteccion_${counter - 1}.json`);
        
        // Crear archivo de selectores clave
        const keySelectors = {
            resumen: `Selectores detectados en ${counter - 1} páginas diferentes`,
            detecciones: allData.length,
            selectores_unicos: {}
        };
        
        // Agrupar selectores únicos
        allData.forEach(detection => {
            const pageName = detection.name || 'unknown';
            if (!keySelectors.selectores_unicos[pageName]) {
                keySelectors.selectores_unicos[pageName] = {
                    url: detection.url,
                    selects: detection.selects.map(s => s.selector).filter(Boolean),
                    buttons: detection.buttons.map(b => b.selector || b.value).filter(Boolean)
                };
            }
        });
        
        fs.writeFileSync('selectores_resumen.json', JSON.stringify(keySelectors, null, 2));
        console.log('📊 Resumen guardado en: selectores_resumen.json');
        
        console.log('\n✨ Navegador permanecerá abierto 10 segundos...');
        await delay(10000);
        
    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        console.error(error.stack);
        await delay(30000);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
})();
