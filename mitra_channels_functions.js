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
            return false;
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
            return false;
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
            return false;
        }
        
        console.log(`✓ mainFrame encontrado: ${mainFrame.url()}`);
        
        // Verificar que tiene el selector de Advanced
        const hasAdvancedTab = await mainFrame.$('a[href*="wlan_others.cgi"]') !== null;
        console.log(`¿Tiene pestaña Advanced? ${hasAdvancedTab}`);
        
        if (!hasAdvancedTab) {
            console.error("❌ El frame no tiene la pestaña Advanced");
            return false;
        }
        
        // Hacer click en la pestaña Advanced
        console.log("Haciendo click en pestaña 'Advanced'...");
        await mainFrame.click('a[href*="wlan_others.cgi"]');
        await delay(4000);
        
        console.log("✓ Click en pestaña 'Advanced'");
        console.log("✓ Se ingresó a la gestión de la red de 2.4GHz");
        return true;
    } catch (error) {
        console.error("Error al navegar a la gestión de 2.4GHz:", error.message);
        return false;
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
            return false;
        }
        
        console.log("✓ Menú 'Network Setting' expandido");
        await delay(1000);
        
        // Click en Wireless 5GHz
        let clicked = false;
        frames = page.frames(); // Actualizar lista de frames
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
            return false;
        }
        
        console.log("✓ Click en 'Wireless 5GHz'");
        
        // Esperar a que cargue la nueva página con más tiempo
        await delay(5000);
        
        // Buscar el frame principal con varios intentos
        let mainFrame = null;
        let attempts = 0;
        const maxAttempts = 5;
        
        while (!mainFrame && attempts < maxAttempts) {
            attempts++;
            console.log(`Buscando frame principal (intento ${attempts}/${maxAttempts})...`);
            
            frames = page.frames(); // Actualizar frames
            console.log(`Frames disponibles (${frames.length}):`);
            frames.forEach(f => console.log(`  - ${f.url()}`));
            
            mainFrame = frames.find(f => 
                f.url().includes('wlan5_general') ||
                f.url().includes('wlan5_') ||
                f.name() === 'mainFrm'
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
            return false;
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
            return false;
        }
        
        console.log("✓ Click en pestaña 'Advanced'");
        await delay(4000);
        
        console.log("✓ Se ingresó a la gestión de la red de 5GHz");
        return true;
    } catch (error) {
        console.error("Error al navegar a la gestión de 5GHz:", error.message);
        return false;
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
            
            // Seleccionar el bandwidth
            await mainFrame.waitForSelector(bandwidthSelector, { visible: true, timeout: 5000 });
            await mainFrame.select(bandwidthSelector, value);
            await delay(2000);
            
            // Hacer clic en Apply
            await mainFrame.waitForSelector(applySelector, { visible: true, timeout: 5000 });
            await mainFrame.click(applySelector);
            await delay(5000);
            
            console.log(`✓ Ancho de banda ${bandwidth} aplicado`);
            
        } catch (error) {
            console.error(`Error al cambiar el ancho de banda a ${bandwidth}:`, error.message);
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
        await delay(2000);
        const availableChannels = await getChannelOptions(mainFrame);
        
        if (availableChannels.length === 0) {
            console.warn(`No se encontraron canales para ${bandwidth}`);
            continue;
        }
        
        // Iterar por cada canal
        for (const channel of availableChannels) {
            const channelText = channel === '0' ? 'Auto' : channel;
            console.log(`\n  Configurando canal ${channelText} en ${bandwidth}...`);
            
            try {
                await mainFrame.select('select#ChannelSelection', channel);
                await delay(2000);
                
                await handleDialog(page);
                await mainFrame.click(applySelector);
                await delay(5000);
                
                // Verificar que el canal se aplicó
                const selectedChannel = await mainFrame.$eval('select#ChannelSelection', sel => sel.value);
                console.log(`  ✓ Canal aplicado: ${selectedChannel === '0' ? 'Auto' : selectedChannel}`);
                
                // Esperar estabilización
                const waitTime = channel === '0' ? 30000 : 15000;
                console.log(`  Esperando ${waitTime/1000}s para estabilización...`);
                await delay(waitTime);
                
                // Capturar pantallas
                await captureScreenshots(page, savePath, channelText, bandwidthForName);
                
            } catch (error) {
                console.error(`  Error configurando canal ${channelText}:`, error.message);
                continue;
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
        
        const webFilename = `channel_${safeChannel}_${safeBandwidth}.png`;
        const inssiderFilename = `inSSIDer_channel_${safeChannel}_${safeBandwidth}.png`;
        
        console.log(`  Guardando capturas: ${webFilename}`);
        
        await page.screenshot({ path: path.join(webPath, webFilename), fullPage: true });
        screenshot({ filename: path.join(inssiderPath, inssiderFilename) });
        console.log("  ✓ Capturas guardadas");
    } catch (error) {
        console.error('  Error al guardar capturas:', error.message);
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