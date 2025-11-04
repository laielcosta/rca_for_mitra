/*
Script para verificar la estructura de Mitra (frames vs page directa)
*/

const puppeteer = require('puppeteer');
const readline = require('readline');

function delay(ms) {
    return new Promise(res => setTimeout(res, ms));
}

function requestPassword() {
    return new Promise((resolve) => {
        const rl = readline.createInterface({ 
            input: process.stdin, 
            output: process.stdout 
        });
        rl.question("Ingrese la contraseña: ", (password) => {
            rl.close();
            resolve(password.trim());
        });
    });
}

(async () => {
    let browser;
    
    try {
        console.log('Iniciando navegador...\n');
        
        browser = await puppeteer.launch({
            headless: false,
            defaultViewport: { width: 1366, height: 768 },
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        
        // Login
        console.log('1. Login...');
        await page.goto("http://192.168.1.1", { waitUntil: "networkidle2" });
        await delay(2000);
        
        const password = await requestPassword();
        await page.type('#syspasswd_1', password);
        await page.click('#Submit');
        
        const dialog = await Promise.race([
            new Promise(resolve => page.once('dialog', resolve)),
            delay(5000).then(() => null)
        ]);
        if (dialog) await dialog.accept();
        
        await delay(3000);
        console.log('✓ Login exitoso\n');
        
        // Deshabilitar Unique SSID
        console.log('2. Deshabilitando Unique SSID...');
        await page.click('input[type="radio"][name="Unique_SSID"][value="0"]');
        await delay(1000);
        await page.click('input[type="button"][name="accept_icon"][id="accept_icon"]');
        await delay(3000);
        console.log('✓ Unique SSID deshabilitado\n');
        
        // Navegar a configuración avanzada
        console.log('3. Navegando a configuración avanzada...');
        await page.click('#menu');
        await delay(1000);
        
        await page.evaluate(() => {
            const link = document.querySelector('a[href="/cgi-bin/Aviso.cgi"]');
            if (link) link.click();
        });
        await delay(2000);
        
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }),
            page.click('input[value="Aceptar"][onclick="reLoad();"]')
        ]);
        
        await delay(3000);
        console.log('✓ Configuración avanzada cargada\n');
        
        // ANÁLISIS DE FRAMES
        console.log('='.repeat(70));
        console.log('ANÁLISIS DE ESTRUCTURA');
        console.log('='.repeat(70));
        
        const frames = page.frames();
        console.log(`\nTotal de frames: ${frames.length}`);
        console.log('\nFrames encontrados:');
        frames.forEach((frame, idx) => {
            console.log(`  ${idx}. name="${frame.name()}" url="${frame.url()}"`);
        });
        
        // Expandir Network Setting y navegar a Wireless 2.4GHz
        console.log('\n4. Expandiendo Network Setting...');
        
        for (const frame of frames) {
            try {
                const expanded = await frame.evaluate(() => {
                    const elements = Array.from(document.querySelectorAll('*'));
                    for (const el of elements) {
                        if (el.textContent?.includes('Network Setting') && el.offsetParent) {
                            el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
                            el.click();
                            return true;
                        }
                    }
                    return false;
                });
                if (expanded) break;
            } catch (e) {
                continue;
            }
        }
        
        await delay(1000);
        console.log('✓ Menú expandido\n');
        
        console.log('5. Haciendo click en Wireless 2.4GHz...');
        
        for (const frame of frames) {
            try {
                const clicked = await frame.evaluate(() => {
                    const elements = Array.from(document.querySelectorAll('*'));
                    for (const el of elements) {
                        if (el.textContent?.trim() === 'Wireless 2.4GHz' && el.offsetParent) {
                            el.click();
                            return true;
                        }
                    }
                    return false;
                });
                if (clicked) break;
            } catch (e) {
                continue;
            }
        }
        
        await delay(5000);
        console.log('✓ Click realizado\n');
        
        // ANÁLISIS DESPUÉS DE NAVEGAR A 2.4GHz
        console.log('='.repeat(70));
        console.log('ANÁLISIS DESPUÉS DE NAVEGAR A WIRELESS 2.4GHz');
        console.log('='.repeat(70));
        
        const newFrames = page.frames();
        console.log(`\nTotal de frames: ${newFrames.length}`);
        console.log('\nFrames:');
        newFrames.forEach((frame, idx) => {
            console.log(`  ${idx}. name="${frame.name()}" url="${frame.url()}"`);
        });
        
        // Probar si los selectores están en page o en frames
        console.log('\n' + '='.repeat(70));
        console.log('BÚSQUEDA DE SELECTORES EN PAGE PRINCIPAL');
        console.log('='.repeat(70));
        
        // Buscar en page principal
        console.log('\nBuscando en page principal:');
        const selectorsInPage = {
            advancedTab: await page.$('a[href*="wlan_others.cgi"]') !== null,
            channelSelection: await page.$('select#ChannelSelection') !== null,
            bandwidth: await page.$('select#wlHT_BW') !== null,
            applyButton: await page.$('input[type="button"][value="Apply"]') !== null
        };
        
        console.log('  ✓ Tab Advanced:', selectorsInPage.advancedTab);
        console.log('  ✓ Select #ChannelSelection:', selectorsInPage.channelSelection);
        console.log('  ✓ Select #wlHT_BW:', selectorsInPage.bandwidth);
        console.log('  ✓ Button Apply:', selectorsInPage.applyButton);
        
        // Buscar en cada frame
        console.log('\n' + '='.repeat(70));
        console.log('BÚSQUEDA DE SELECTORES EN CADA FRAME');
        console.log('='.repeat(70));
        
        for (let i = 0; i < newFrames.length; i++) {
            const frame = newFrames[i];
            console.log(`\nFrame ${i}: ${frame.url()}`);
            
            try {
                const selectorsInFrame = {
                    advancedTab: await frame.$('a[href*="wlan_others.cgi"]') !== null,
                    channelSelection: await frame.$('select#ChannelSelection') !== null,
                    bandwidth: await frame.$('select#wlHT_BW') !== null,
                    applyButton: await frame.$('input[type="button"][value="Apply"]') !== null
                };
                
                console.log('  Tab Advanced:', selectorsInFrame.advancedTab);
                console.log('  Select #ChannelSelection:', selectorsInFrame.channelSelection);
                console.log('  Select #wlHT_BW:', selectorsInFrame.bandwidth);
                console.log('  Button Apply:', selectorsInFrame.applyButton);
                
                if (selectorsInFrame.advancedTab) {
                    console.log('\n  🎯 ESTE FRAME TIENE LA PESTAÑA ADVANCED!');
                }
            } catch (error) {
                console.log('  ❌ Error accediendo al frame:', error.message);
            }
        }
        
        // CONCLUSIÓN
        console.log('\n' + '='.repeat(70));
        console.log('CONCLUSIÓN');
        console.log('='.repeat(70));
        
        if (selectorsInPage.advancedTab) {
            console.log('\n✅ Los selectores están en PAGE (no en frames)');
            console.log('   Usar: page.$() y page.click()');
        } else {
            const frameWithSelectors = [];
            for (let i = 0; i < newFrames.length; i++) {
                const frame = newFrames[i];
                try {
                    if (await frame.$('a[href*="wlan_others.cgi"]')) {
                        frameWithSelectors.push({ index: i, url: frame.url() });
                    }
                } catch (e) {}
            }
            
            if (frameWithSelectors.length > 0) {
                console.log('\n✅ Los selectores están en FRAME(S):');
                frameWithSelectors.forEach(f => {
                    console.log(`   Frame ${f.index}: ${f.url}`);
                });
                console.log('\n   Usar: frame.$() y frame.click()');
            } else {
                console.log('\n❌ No se encontraron selectores ni en page ni en frames');
                console.log('   Puede que la página no haya cargado completamente');
            }
        }
        
        console.log('\n\nPresiona Enter para cerrar...');
        await new Promise(resolve => {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });
            rl.question('', () => {
                rl.close();
                resolve();
            });
        });
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error.stack);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
})();
