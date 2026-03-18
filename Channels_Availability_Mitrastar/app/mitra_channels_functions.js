const fs = require('fs');
const path = require('path');
const { exec } = require("child_process");
const screenshot = require('screenshot-desktop');

module.exports = {
    createMainFolder,
    requestPassword,
    runInSSIDer,
    login,
    delay,
    navigateToDeviceWebPage,
    navigateToAdvancedSettings,
    navigateTo24GHzManagement,
    navigateTo5GHzManagement,
    getBandwidthOptions,
    getChannelOptions,
    BandwidthAndIterateChannels,
    captureScreenshots,
    iterateChannels,
    handleDialog,
    disableUniqueSSID,
    getSSID
};

function delay(ms) {
    return new Promise(res => setTimeout(res, ms));
}

async function disableUniqueSSID(page) {
    try {
        console.log("Deshabilitando Unique SSID...");
        
        await page.waitForSelector('input[type="radio"][name="Unique_SSID"][value="0"]', { 
            visible: true, 
            timeout: 10000 
        });
        
        await page.click('input[type="radio"][name="Unique_SSID"][value="0"]');
        await delay(1000);
        
        await page.waitForSelector('input[type="button"][name="accept_icon"][id="accept_icon"]', { 
            visible: true 
        });
        await page.click('input[type="button"][name="accept_icon"][id="accept_icon"]');
        
        console.log("Botón 'Aplicar cambios' presionado");
        await delay(3000);
        
        console.log("Unique SSID deshabilitado correctamente");
        return true;
    } catch (error) {
        console.error("Error al deshabilitar Unique SSID:", error.message);
        return false;
    }
}

async function getSSID(page) {
    try {
        console.log("Obteniendo SSID del dispositivo...");
        
        await page.waitForSelector('input[name="ssidname"][id="ssidname"]', { 
            visible: true, 
            timeout: 10000 
        });
        
        const ssidValue = await page.$eval('input[name="ssidname"][id="ssidname"]', el => el.value);
        
        console.log(`SSID detectado: ${ssidValue}`);
        console.log("Filtre en inSSIDer por SSID:", ssidValue);
        
        return ssidValue;
    } catch (error) {
        console.error("Error al obtener el SSID:", error.message);
        return null;
    }
}

let dialogRegistered = false;

async function handleDialog(page) {
    if (!dialogRegistered) {
        page.on('dialog', async (dialog) => {
            try {
                console.log(`Mensaje del dispositivo: ${dialog.message()}`);
                await dialog.accept();
            } catch (error) {
                console.error("Error al manejar el diálogo:", error);
            }
        });
        dialogRegistered = true;
    }
}

async function navigateToDeviceWebPage(page) {
    try {
        console.log('Accediendo a la WEB del dispositivo...');
        await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36");
        await page.goto("http://192.168.1.1", { waitUntil: "networkidle2" });
        await delay(1000);
        return true;
    } catch (error) {
        console.error("Error al navegar a la página web del dispositivo:", error);
        return false;
    }
}

async function navigateToAdvancedSettings(page) {
    try {
        console.log("Abriendo menú principal...");
        
        await page.waitForSelector('#menu', { visible: true, timeout: 10000 });
        await page.click('#menu');
        await delay(1000);
        console.log("Menú abierto");
        
        console.log("Buscando 'Configuración avanzada' en el menú...");
        
        const clicked = await page.evaluate(() => {
            const link = document.querySelector('a[href="/cgi-bin/Aviso.cgi"]');
            if (link) {
                link.click();
                return true;
            }
            return false;
        });
        
        if (!clicked) {
            throw new Error("No se encontró el link de Configuración avanzada");
        }
        
        console.log("Click en Configuración avanzada");
        await delay(2000);
        
        console.log("Esperando diálogo de confirmación...");
        try {
            await page.waitForSelector('input[value="Aceptar"][onclick="reLoad();"]', { 
                visible: true, 
                timeout: 5000 
            });
            
            console.log("Diálogo encontrado, haciendo click en Aceptar y esperando navegación...");
            
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }),
                page.click('input[value="Aceptar"][onclick="reLoad();"]')
            ]);
            
            console.log("✓ Navegación completada");
            await delay(3000);
            
            const frames = page.frames();
            console.log(`✓ Interfaz con frames cargada (${frames.length} frames detectados)`);
            
            console.log("Se accedió a la configuración avanzada");
            return true;
        } catch (e) {
            console.log("Error esperando diálogo:", e.message);
            return false;
        }
        
    } catch (error) {
        console.error("Error al acceder a la configuración avanzada:", error.message);
        return false;
    }
}

async function navigateTo24GHzManagement(page) {
    try {
        console.log("Navegando a configuración de 2.4GHz...");
        
        // Expandir menú Network Setting
        console.log("Buscando y expandiendo menú 'Network Setting'...");
        let frames = page.frames();
        
        let menuExpanded = false;
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
                
                if (expanded) {
                    menuExpanded = true;
                    break;
                }
            } catch (e) {
                continue;
            }
        }
        
        if (!menuExpanded) {
            console.error("No se pudo expandir el menú Network Setting");
            return null;
        }
        
        console.log("✓ Menú 'Network Setting' expandido");
        await delay(1000);
        
        // Click en Wireless 2.4GHz
        let clicked = false;
        frames = page.frames();
        for (const frame of frames) {
            try {
                const success = await frame.evaluate(() => {
                    const elements = Array.from(document.querySelectorAll('*'));
                    for (const el of elements) {
                        const text = el.textContent?.trim();
                        if (text === 'Wireless 2.4GHz' && el.offsetParent) {
                            el.click();
                            return true;
                        }
                    }
                    return false;
                });
                
                if (success) {
                    clicked = true;
                    break;
                }
            } catch (e) {
                continue;
            }
        }
        
        if (!clicked) {
            console.error("No se pudo hacer click en Wireless 2.4GHz");
            return null;
        }
        
        console.log("✓ Click en 'Wireless 2.4GHz'");
        await delay(5000);
        
        // Buscar el mainFrame - ahora sabemos que es tabFW.cgi
        let mainFrame = null;
        let attempts = 0;
        const maxAttempts = 5;
        
        while (!mainFrame && attempts < maxAttempts) {
            attempts++;
            console.log(`Buscando mainFrame (intento ${attempts}/${maxAttempts})...`);
            
            frames = page.frames();
            console.log(`Frames disponibles (${frames.length}):`);
            frames.forEach(f => console.log(`  - name="${f.name()}" url="${f.url()}"`));
            
            // Buscar frame con tabFW.cgi o mainFrame
            mainFrame = frames.find(f => 
                f.name() === 'mainFrame' ||
                f.url().includes('tabFW.cgi') ||
                f.url().includes('wlan_general')
            );
            
            if (!mainFrame) {
                console.log(`mainFrame no encontrado, esperando 2s más...`);
                await delay(2000);
            }
        }
        
        if (!mainFrame) {
            console.error("❌ No se encontró mainFrame para 2.4GHz");
            return null;
        }
        
        console.log(`✓ mainFrame encontrado: ${mainFrame.url()}`);
        
        // Verificar que tiene el selector de Advanced
        const hasAdvancedTab = await mainFrame.$('a[href*="wlan_others.cgi"]') !== null;
        console.log(`¿Tiene pestaña Advanced? ${hasAdvancedTab}`);
        
        if (!hasAdvancedTab) {
            console.error("❌ El frame no tiene la pestaña Advanced");
            return null;
        }
        
        // Hacer click en la pestaña Advanced
        console.log("Haciendo click en pestaña 'Advanced'...");
        await mainFrame.click('a[href*="wlan_others.cgi"]');
        console.log("✓ Click en pestaña 'Advanced'");
        
        // El contenido cambia DENTRO del mismo frame, no se crea uno nuevo
        // Esperamos a que el contenido de Advanced se cargue
        await delay(5000);
        
        // Verificar que el selector de bandwidth existe (confirma que estamos en Advanced)
        try {
            await mainFrame.waitForSelector('select#wlHT_BW', { 
                visible: true, 
                timeout: 10000 
            });
            console.log("✓ Selector de bandwidth detectado - contenido de Advanced cargado");
        } catch (error) {
            console.error("❌ No se detectó el selector de bandwidth en Advanced");
            console.error("El contenido de Advanced no se cargó correctamente");
            return null;
        }
        
        console.log("✓ Se ingresó a la gestión de la red de 2.4GHz");
        return mainFrame; // Retornar el MISMO frame, ya que el contenido cambió dentro de él
        
    } catch (error) {
        console.error("Error al navegar a la gestión de 2.4GHz:", error.message);
        return null;
    }
}

async function navigateTo5GHzManagement(page) {
    try {
        console.log("Navegando a configuración de 5GHz...");
        
        // Expandir menú Network Setting
        console.log("Buscando y expandiendo menú 'Network Setting'...");
        let frames = page.frames();
        
        let menuExpanded = false;
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
                
                if (expanded) {
                    menuExpanded = true;
                    break;
                }
            } catch (e) {
                continue;
            }
        }
        
        if (!menuExpanded) {
            console.error("No se pudo expandir el menú Network Setting");
            return null;
        }
        
        console.log("✓ Menú 'Network Setting' expandido");
        await delay(1000);
        
        // Click en Wireless 5GHz
        let clicked = false;
        frames = page.frames();
        for (const frame of frames) {
            try {
                const success = await frame.evaluate(() => {
                    const elements = Array.from(document.querySelectorAll('*'));
                    for (const el of elements) {
                        const text = el.textContent?.trim();
                        if (text === 'Wireless 5GHz' && el.offsetParent) {
                            el.click();
                            return true;
                        }
                    }
                    return false;
                });
                
                if (success) {
                    clicked = true;
                    break;
                }
            } catch (e) {
                continue;
            }
        }
        
        if (!clicked) {
            console.error("No se pudo hacer click en Wireless 5GHz");
            return null;
        }
        
        console.log("✓ Click en 'Wireless 5GHz'");
        await delay(5000);
        
        // Buscar el frame principal con varios intentos
        let mainFrame = null;
        let attempts = 0;
        const maxAttempts = 5;
        
        while (!mainFrame && attempts < maxAttempts) {
            attempts++;
            console.log(`Buscando frame principal (intento ${attempts}/${maxAttempts})...`);
            
            frames = page.frames();
            console.log(`Frames disponibles (${frames.length}):`);
            frames.forEach(f => console.log(`  - ${f.url()}`));
            
            mainFrame = frames.find(f => 
                f.url().includes('wlan5_general') ||
                f.url().includes('tabFW.cgi?tabJson=../html/pages/network/wireless5G') ||
                f.name() === 'mainFrame'
            );
            
            if (!mainFrame) {
                console.log(`Frame no encontrado, esperando 2s más...`);
                await delay(2000);
            }
        }
        
        if (!mainFrame) {
            console.error("❌ No se encontró el frame principal después de navegar a 5GHz");
            console.error("Frames finales disponibles:");
            page.frames().forEach(f => console.error(`  - ${f.url()}`));
            return null;
        }
        
        console.log(`✓ Frame principal encontrado: ${mainFrame.url()}`);
        
        // Hacer click en la pestaña Advanced
        console.log("Haciendo click en pestaña 'Advanced'...");
        const advClicked = await mainFrame.evaluate(() => {
            const link = document.querySelector('a[href*="wlan5_others.cgi"]');
            if (link) {
                link.click();
                return true;
            }
            return false;
        });
        
        if (!advClicked) {
            console.error("No se pudo hacer click en Advanced");
            return null;
        }
        
        console.log("✓ Click en pestaña 'Advanced'");
        
        // El contenido cambia DENTRO del mismo frame, no se crea uno nuevo
        // Esperamos a que el contenido de Advanced se cargue
        await delay(5000);
        
        // Verificar que el selector de bandwidth existe (confirma que estamos en Advanced)
        try {
            await mainFrame.waitForSelector('select#Bandwidth', { 
                visible: true, 
                timeout: 10000 
            });
            console.log("✓ Selector de bandwidth detectado - contenido de Advanced cargado");
        } catch (error) {
            console.error("❌ No se detectó el selector de bandwidth en Advanced");
            console.error("El contenido de Advanced no se cargó correctamente");
            return null;
        }
        
        console.log("✓ Se ingresó a la gestión de la red de 5GHz");
        return mainFrame; // Retornar el MISMO frame, ya que el contenido cambió dentro de él
        
    } catch (error) {
        console.error("Error al navegar a la gestión de 5GHz:", error.message);
        return null;
    }
}

function sanitizeName(name) {
    return name.replace(/[\/:*?"<>|]/g, '_');
}

function getDesktopPath() {
    return 'C:\\CapturasCanales';
}

async function getBandwidthOptions(mainFrame, band) {
    try {
        console.log(`Obteniendo opciones de ancho de banda para ${band}...`);
        
        // Para 2.4GHz usa #wlHT_BW, para 5GHz usa #Bandwidth
        const selector = band === '2.4GHz' ? 'select#wlHT_BW' : 'select#Bandwidth';
        
        await mainFrame.waitForSelector(selector, { 
            visible: true, 
            timeout: 10000 
        });
        
        const options = await mainFrame.$$eval(selector + ' option', opts => 
            opts.map(opt => ({
                value: opt.value,
                bandwidth: opt.textContent.trim()
            }))
        );
        
        console.log(`Opciones de bandwidth detectadas:`, options);
        return options;
    } catch (error) {
        console.error(`Error obteniendo opciones de bandwidth para ${band}:`, error.message);
        return [];
    }
}

async function getChannelOptions(mainFrame) {
    try {
        console.log("Obteniendo canales disponibles...");
        
        await mainFrame.waitForSelector('select#ChannelSelection', { 
            visible: true, 
            timeout: 10000 
        });
        
        const channels = await mainFrame.$$eval('select#ChannelSelection option', opts => 
            opts.map(opt => opt.value)
        );
        
        console.log(`Canales disponibles:`, channels);
        return channels;
    } catch (error) {
        console.error("Error obteniendo canales:", error.message);
        return [];
    }
}

async function BandwidthAndIterateChannels(mainFrame, finalPath, page, band, optionsData) {
    console.log(`\nIniciando iteración de anchos de banda para ${band}...`);
    
    await handleDialog(page);
    
    // Selector de bandwidth según la banda
    const bandwidthSelector = band === '2.4GHz' ? 'select#wlHT_BW' : 'select#Bandwidth';
    const applySelector = 'input[type="button"][value="Apply"]';
    
    for (const { value, bandwidth } of optionsData) {
        console.log(`\n=== Configurando ancho de banda: ${bandwidth} ===`);
        
        const bandwidthForName = sanitizeName(bandwidth.replace(' ', '').replace('/', '_'));
        
        try {
            await handleDialog(page);
            
            // IMPORTANTE: Buscar el frame correcto antes de cada operación
            let currentFrame = null;
            const frames = page.frames();
            const frameIdentifier = band === '2.4GHz' ? 'wlan_others.cgi' : 'wlan5_others.cgi';
            
            for (const f of frames) {
                if (f.url().includes(frameIdentifier) || f.name() === 'mainFrame') {
                    // Verificar que tiene el selector que necesitamos
                    const hasSelector = await f.$(bandwidthSelector).catch(() => null);
                    if (hasSelector) {
                        currentFrame = f;
                        break;
                    }
                }
            }
            
            if (!currentFrame) {
                console.error(`No se encontró el frame correcto para ${band}`);
                continue;
            }
            
            // Seleccionar el bandwidth
            await currentFrame.waitForSelector(bandwidthSelector, { visible: true, timeout: 10000 });
            await currentFrame.select(bandwidthSelector, value);
            console.log(`  Bandwidth seleccionado: ${bandwidth}`);
            await delay(2000);
            
            // Hacer clic en Apply
            await currentFrame.waitForSelector(applySelector, { visible: true, timeout: 5000 });
            await currentFrame.click(applySelector);
            
            console.log(`  ✓ Botón Apply presionado`);
            
            // ⚠️ NUEVO: Esperar según la banda (5GHz reinicia la interfaz, toma más tiempo)
            if (band === '5GHz') {
                console.log('  ⏳ Esperando 28 segundos para reinicio de interfaz 5GHz...');
                await delay(28000);
            } else {
                console.log('  ⏳ Esperando 8 segundos para aplicar cambios...');
                await delay(8000);
            }
            
            // CRÍTICO: Navegar a la pestaña GENERAL (no Advanced) para acceder a los canales
            console.log('  🔄 Navegando a pestaña General para seleccionar canales...');
            
            // Buscar el mainFrame nuevamente
            let newMainFrame = null;
            let attempts = 0;
            const maxAttempts = 3;
            
            while (!newMainFrame && attempts < maxAttempts) {
                attempts++;
                const newFrames = page.frames();
                
                for (const f of newFrames) {
                    if (f.name() === 'mainFrame' || f.url().includes('tabFW.cgi')) {
                        newMainFrame = f;
                        break;
                    }
                }
                
                if (!newMainFrame) {
                    console.log(`    Intento ${attempts}/${maxAttempts} - Frame no encontrado, esperando...`);
                    await delay(3000);
                }
            }
            
            if (!newMainFrame) {
                console.error('  ❌ No se pudo recuperar el mainFrame');
                continue;
            }
            
            // Click en la pestaña GENERAL (no Advanced)
            const generalLink = band === '2.4GHz' ? 'a[href*="wlan_general.cgi"]' : 'a[href*="wlan5_general.cgi"]';
            
            const clicked = await newMainFrame.evaluate((selector) => {
                const link = document.querySelector(selector);
                if (link) {
                    link.click();
                    return true;
                }
                return false;
            }, generalLink);
            
            if (!clicked) {
                console.error('  ❌ No se pudo hacer click en General');
                continue;
            }
            
            console.log('  ✓ Click en General completado');
            await delay(5000);
            
            // Actualizar la referencia del mainFrame para las siguientes operaciones
            mainFrame = newMainFrame;
            
            console.log(`✓ Ancho de banda ${bandwidth} configurado - en pestaña General`);
            
        } catch (error) {
            console.error(`Error al cambiar el ancho de banda a ${bandwidth}:`, error.message);
            console.error(error.stack);
            continue;
        }

        // Crear carpeta para este bandwidth
        let freqFolder = band === '5GHz' ? '5GHz' : sanitizeName('2_4GHz');
        let bwFolder = bandwidthForName;
        
        const savePath = path.join(finalPath, freqFolder, bwFolder);
        
        // Asegurarnos de que la carpeta existe
        if (!fs.existsSync(savePath)) {
            fs.mkdirSync(savePath, { recursive: true });
            fs.mkdirSync(path.join(savePath, 'WEB'), { recursive: true });
            fs.mkdirSync(path.join(savePath, 'INSSIDER'), { recursive: true });
        }
        
        // Obtener canales disponibles para este bandwidth
        console.log('  Obteniendo canales disponibles...');
        await delay(2000);
        
        // Buscar el frame con el selector de canales (debería estar en General)
        let channelFrame = null;
        const allFrames = page.frames();
        for (const f of allFrames) {
            const hasChannelSelector = await f.$('select#ChannelSelection').catch(() => null);
            if (hasChannelSelector) {
                channelFrame = f;
                break;
            }
        }
        
        if (!channelFrame) {
            console.warn(`  ⚠ No se encontró el selector de canales para ${bandwidth}`);
            continue;
        }
        
        const availableChannels = await channelFrame.$$eval('select#ChannelSelection option', opts => 
            opts.map(opt => opt.value)
        );
        
        console.log(`  Canales disponibles: ${availableChannels.join(', ')}`);
        
        if (availableChannels.length === 0) {
            console.warn(`  No se encontraron canales para ${bandwidth}`);
            continue;
        }
        
        // ============================================================
        // ITERACIÓN DE CANALES CON TIEMPOS AJUSTADOS PARA 5GHz
        // ============================================================
        
        // 🔑 NUEVO: Determinar si son canales DFS (requieren escaneo de radar)
        const isDFSChannel = (channel) => {
            const channelNum = parseInt(channel);
            // Canales DFS en 5GHz: 52-140 (aproximadamente)
            return band === '5GHz' && channelNum >= 52 && channelNum <= 144;
        };
        
        for (let i = 0; i < availableChannels.length; i++) {
            const channel = availableChannels[i];
            const channelText = channel === '0' ? 'Auto' : channel;
            const isFirstChannel = i === 0; // Detectar si es el primer canal después de cambio de bandwidth
            
            console.log(`\n    → Configurando canal ${channelText}...`);
            
            try {
                // Buscar el frame actual para este canal
                let currentChannelFrame = null;
                const channelFrames = page.frames();
                for (const f of channelFrames) {
                    const hasSelector = await f.$('select#ChannelSelection').catch(() => null);
                    if (hasSelector) {
                        currentChannelFrame = f;
                        break;
                    }
                }
                
                if (!currentChannelFrame) {
                    console.error(`    ❌ Frame perdido para canal ${channelText}`);
                    continue;
                }
                
                // Seleccionar el canal
                await currentChannelFrame.select('select#ChannelSelection', channel);
                console.log(`    Canal ${channelText} seleccionado en dropdown`);
                await delay(2000);
                
                // Aplicar el cambio
                await handleDialog(page);
                await currentChannelFrame.click(applySelector);
                console.log(`    ✓ Botón Apply presionado`);
                
                // ⚠️ CRÍTICO: TIEMPOS AJUSTADOS PARA 5GHz
                let waitTime;
                
                if (band === '5GHz') {
                    // 5GHz necesita más tiempo
                    if (channel === '0') {
                        // Canal Auto
                        waitTime = 35000; // 35s para Auto en 5GHz
                        console.log(`    ⏳ [5GHz-Auto] Esperando ${waitTime/1000}s...`);
                    } else if (isFirstChannel) {
                        // PRIMER CANAL después de cambio de bandwidth
                        waitTime = 40000; // 40s para primer canal (interfaz debe estabilizarse completamente)
                        console.log(`    ⏳ [5GHz-Primer canal post-BW] Esperando ${waitTime/1000}s...`);
                    } else if (isDFSChannel(channel)) {
                        // Canales DFS (requieren escaneo de radar)
                        waitTime = 35000; // 35s para canales DFS
                        console.log(`    ⏳ [5GHz-DFS] Esperando ${waitTime/1000}s (escaneo de radar)...`);
                    } else {
                        // Canales normales de 5GHz
                        waitTime = 28000; // 28s para canales normales
                        console.log(`    ⏳ [5GHz-Normal] Esperando ${waitTime/1000}s...`);
                    }
                } else {
                    // 2.4GHz - tiempos originales que funcionan bien
                    if (channel === '0') {
                        waitTime = 28000;
                        console.log(`    ⏳ [2.4GHz-Auto] Esperando ${waitTime/1000}s...`);
                    } else {
                        waitTime = 22000;
                        console.log(`    ⏳ [2.4GHz-Normal] Esperando ${waitTime/1000}s...`);
                    }
                }
                
                // Esperar sin interrupciones
                await delay(waitTime);
                
                // Estabilización de inSSIDer (mismo para ambas bandas)
                console.log(`    ⏳ Esperando 6s adicionales para estabilización de inSSIDer...`);
                await delay(6000);
                
                // Solo ahora capturar - sin verificar nada antes
                console.log(`    📸 Capturando evidencias...`);
                await captureScreenshots(page, savePath, channelText, bandwidthForName);
                
            } catch (error) {
                console.error(`    ❌ Error configurando canal ${channelText}:`, error.message);
                continue;
            }
        }
        
        // IMPORTANTE: Después de terminar todos los canales de este bandwidth,
        // volver a Advanced para poder cambiar al siguiente bandwidth
        const currentBandwidthIndex = optionsData.findIndex(opt => opt.value === value);
        if (currentBandwidthIndex < optionsData.length - 1) {
            console.log(`\n  🔄 Volviendo a pestaña Advanced para siguiente bandwidth...`);
            
            const advLink = band === '2.4GHz' ? 'a[href*="wlan_others.cgi"]' : 'a[href*="wlan5_others.cgi"]';
            
            let advFrame = null;
            const advFrames = page.frames();
            for (const f of advFrames) {
                if (f.name() === 'mainFrame' || f.url().includes('tabFW.cgi')) {
                    advFrame = f;
                    break;
                }
            }
            
            if (advFrame) {
                const advClicked = await advFrame.evaluate((selector) => {
                    const link = document.querySelector(selector);
                    if (link) {
                        link.click();
                        return true;
                    }
                    return false;
                }, advLink);
                
                if (advClicked) {
                    console.log('  ✓ De vuelta en Advanced');
                    await delay(5000);
                    mainFrame = advFrame;
                }
            }
        }
    }
}

async function captureScreenshots(page, savePath, channel, bandwidthForName) {
    try {
        const webPath = path.join(savePath, 'WEB');
        const inssiderPath = path.join(savePath, 'INSSIDER');
        
        if (!fs.existsSync(webPath)) {
            fs.mkdirSync(webPath, { recursive: true });
        }
        if (!fs.existsSync(inssiderPath)) {
            fs.mkdirSync(inssiderPath, { recursive: true });
        }

        const safeChannel = sanitizeName(channel.toString());
        const safeBandwidth = sanitizeName(bandwidthForName);
        
        // Captura de la WEB del router (una sola vez)
        const webFilename = `channel_${safeChannel}_${safeBandwidth}.png`;
        console.log(`    📸 Capturando interfaz web: ${webFilename}`);
        await page.screenshot({ path: path.join(webPath, webFilename), fullPage: true });
        
        // Estrategia de 2 capturas de inSSIDer con intervalo corto
        console.log(`    📸 Capturando inSSIDer (2 capturas)...`);
        
        for (let i = 1; i <= 2; i++) {
            const inssiderFilename = `inSSIDer_channel_${safeChannel}_${safeBandwidth}_${i}.png`;
            
            try {
                await screenshot({ filename: path.join(inssiderPath, inssiderFilename) });
                console.log(`      ✓ Captura ${i}/2 guardada`);
            } catch (error) {
                console.error(`      ⚠ Error en captura ${i}/2:`, error.message);
            }
            
            // Esperar 3 segundos entre capturas (solo después de la primera)
            if (i < 2) {
                await delay(3000);
            }
        }
        
        console.log("    ✓ Capturas completadas");
        
    } catch (error) {
        console.error('    Error al guardar capturas:', error.message);
    }
}

async function iterateChannels(mainFrame, finalPath, page, band) {
    if (!mainFrame) {
        console.error(`mainFrame no definido para ${band}`);
        return;
    }
    
    await delay(1500);
    const optionsData = await getBandwidthOptions(mainFrame, band);
    console.log(`Opciones de ancho de banda detectadas para ${band}:`, optionsData.map(opt => opt.bandwidth));
    
    if (optionsData.length === 0) {
        console.warn(`No se encontraron opciones de ancho de banda para ${band}`);
        return;
    }

    await BandwidthAndIterateChannels(mainFrame, finalPath, page, band, optionsData);
}

function createMainFolder() {
    const baseDir = getDesktopPath();
    const date = new Date().toISOString().split('T')[0];
    let folderName = sanitizeName(`Channel_availability_${date}`);
    let finalPath = path.join(baseDir, folderName);
    let counter = 1;

    try {
        if (!fs.existsSync(baseDir)) {
            fs.mkdirSync(baseDir, { recursive: true });
            console.log(`Directorio base creado: ${baseDir}`);
        }
    } catch (error) {
        console.error(`Error al crear el directorio base ${baseDir}:`, error.message);
        return null;
    }

    while (fs.existsSync(finalPath)) {
        folderName = sanitizeName(`Channel_availability_${date}_(${counter++})`);
        finalPath = path.join(baseDir, folderName);
    }

    try {
        fs.mkdirSync(finalPath, { recursive: true });
        console.log(`Las capturas se guardarán en: ${finalPath}`);
        console.log(`Path absoluto completo: ${path.resolve(finalPath)}`);
        return finalPath;
    } catch (error) {
        console.error(`Error al crear las carpetas: ${error.message}`);
        return null;
    }
}

function requestPassword() {
    return new Promise((resolve) => {
        const readline = require('readline').createInterface({ input: process.stdin, output: process.stdout });
        readline.question("Ingrese la contraseña (o presione Enter para cancelar): ", (password) => {
            readline.close();
            resolve(password.trim() || null);
        });
    });
}

function runInSSIDer(inSSIDerPath) {
    exec(inSSIDerPath, (error) => {
        if (error) console.error("Error al ejecutar inSSIDer:", error.message);
    });
}

async function login(page) {
    let password, loginSuccessful = false;

    while (!loginSuccessful) {
        password = await requestPassword();
        if (!password) {
            console.log("El usuario canceló la entrada de la contraseña.");
            return false;
        }
        try {
            await page.waitForSelector('#syspasswd_1', { visible: true, timeout: 120000 });
            await page.type('#syspasswd_1', password);
            await page.click('#Submit');
            const dialog = await Promise.race([
                new Promise(resolve => page.once('dialog', resolve)),
                delay(5000).then(() => null)
            ]);
            if (dialog) {
                console.log(`Mensaje del dispositivo: ${dialog.message()}`);
                await dialog.accept();
                loginSuccessful = !dialog.message().includes('incorrecta');
            } else {
                await page.waitForSelector('#pagemenu', { timeout: 5000 });
                loginSuccessful = true;
            }
            console.log(loginSuccessful ? 'Inicio de sesión exitoso' : 'Contraseña incorrecta. Intente nuevamente.');
        } catch (error) {
            console.error("Error durante el intento de inicio de sesión:", error);
            return false;
        }
    }
    return true;
}