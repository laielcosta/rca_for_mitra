
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
        
        // Esperar a que los elementos estén disponibles
        await page.waitForSelector('input[type="radio"][name="Unique_SSID"][value="0"]', { 
            visible: true, 
            timeout: 10000 
        });
        
        // Seleccionar el radio button "Desactivado" (value="0")
        await page.click('input[type="radio"][name="Unique_SSID"][value="0"]');
        await delay(1000);
        
        // Hacer clic en el botón "Aplicar cambios"
        await page.waitForSelector('input[type="button"][name="accept_icon"][id="accept_icon"]', { 
            visible: true 
        });
        await page.click('input[type="button"][name="accept_icon"][id="accept_icon"]');
        
        console.log("Botón 'Aplicar cambios' presionado");
        await delay(3000); // Esperar a que se apliquen los cambios
        
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
        
        // Esperar a que el input del SSID esté disponible
        await page.waitForSelector('input[name="ssidname"][id="ssidname"]', { 
            visible: true, 
            timeout: 10000 
        });
        
        // Obtener el valor del SSID
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

//Función gestiona los diálogos pop-up
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

// Ingresa a las Web de administración del dispositivo
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

// Navega hasta la configuración avanzada
async function navigateToAdvancedSettings(page) {
    try {
        console.log("Abriendo menú principal...");
        
        // Hacer clic en el botón MENÚ
        await page.waitForSelector('#menu', { visible: true, timeout: 10000 });
        await page.click('#menu');
        await delay(1000);
        console.log("Menú abierto");
        
        console.log("Intentando acceder a la configuración avanzada...");
        
        // Buscar y hacer clic en "Configuracion avanzada" usando evaluate
        await page.evaluate(() => {
            const menuItems = document.querySelectorAll('#menu a, #menu div[onclick]');
            for (const item of menuItems) {
                if (item.textContent.includes('Configuracion avanzada') || 
                    item.textContent.includes('Configuración avanzada')) {
                    item.click();
                    break;
                }
            }
        });
        
        await delay(2000);
        
        // Manejar diálogo de confirmación
        await handleDialog(page);
        
        // Hacer clic en Aceptar si aparece el botón
        try {
            await page.waitForSelector('input[type="button"][value="Aceptar"]', { 
                visible: true, 
                timeout: 3000 
            });
            await page.click('input[type="button"][value="Aceptar"]');
            console.log("Se accedió a la configuración avanzada");
            await delay(2000);
        } catch (e) {
            console.log("No se requirió confirmación adicional");
        }
        
        return true;
    } catch (error) {
        console.error("Error al acceder a la configuración avanzada:", error.message);
        return false;
    }
}

// Navega hasta la configuración de la interfaz de 2,4GHz
async function navigateTo24GHzManagement(CAFrame) {
    try {
        await CAFrame.click('a[url="wifi.asp"]');
        console.log("Se ingresó a la gestión de la red de 2,4GHz");
        return true;
    } catch (error) {
        console.error("Error al acceder a la gestión de la red de 2,4GHz:", error);
        return false;
    }
}

// Navega hasta la configuración de la interfaz de 5GHz
async function navigateTo5GHzManagement(CAFrame) {
    try {
        await CAFrame.click('a[url="wifi5g.asp"]');
        console.log("Se ingresó a la gestión de la red de 5GHz");
        return true;
    } catch (error) {
        console.error("Error al acceder a la gestión de la red de 5GHz:", error);
        return false;
    }
}

// Función para sanitizar nombres de archivos/carpetas
function sanitizeName(name) {
    return name.replace(/[^a-z0-9_\-\.]/gi, "_");
}

// Devuelve la ruta fija en C: para las capturas
function getDesktopPath() {
    return path.resolve("C:\\CapturasCanales");
}

// Obtiene los valores de ancho de banda desde el DOM
async function getBandwidthOptions(mainFrame) {
    await mainFrame.waitForSelector('select#adm_bandwidth', { visible: true });
    try {
        return await mainFrame.evaluate(() => {
            const options = document.querySelectorAll('select#adm_bandwidth option');
            if (!options.length) throw new Error('No se encontraron opciones para el ancho de banda.');
            return Array.from(options).map(option => ({
                value: option.value,
                bandwidth: option.textContent.trim()
            }));
        });
    } catch (error) {
        console.error('Error al obtener los datos del selector de ancho de banda:', error.message);
        return [];
    }
}

async function BandwidthAndIterateChannels(mainFrame, finalPath, page, band, optionsData) {
    for (const { value, bandwidth } of optionsData) {
        console.log(`Ancho de banda seleccionado: ${bandwidth}`);
        let bandwidthForName = sanitizeName(bandwidth.replace('/', '_').replace(' ', ''));

        try {
            await handleDialog(page);
            await mainFrame.waitForSelector('select#adm_bandwidth', { visible: true, timeout: 5000 });
            await mainFrame.select('select#adm_bandwidth', value);
            await mainFrame.click('input[value="Apply"]');
        } catch (error) {
            console.error(`Error al cambiar el ancho de banda a ${bandwidth}:`, error.message);
            continue;
        }

        await delay(2000);
        let freqFolder = band === '5GHz' ? '5GHz' : sanitizeName('2_4GHz');
        let bwFolder = sanitizeName(bandwidth.replace(' ', '').replace('/', '_'));
        if (band === '2.4GHz' && !['20MHz', '20MHz_40MHz'].includes(bwFolder)) continue;
        if (band === '5GHz' && !['20MHz', '40MHz', '80MHz'].includes(bwFolder)) continue;
        const savePath = path.join(finalPath, freqFolder, bwFolder);

        let availableChannels = await mainFrame.$$eval('select#adm_channel option', options => 
            options.map(opt => opt.value).filter(value => value !== "0") // Excluir "Auto"
        );
        
        console.log("Canales disponibles:", availableChannels);
        
        for (let channel of availableChannels) {
            console.log(`Seleccionando canal ${channel}. Ancho de banda ${bandwidth}...`);
            try {
                await mainFrame.select('select#adm_channel', channel);
                await delay(2000);
                await handleDialog(page);
                await mainFrame.click('input[value="Apply"]');
        
                // Esperar para confirmar el cambio
                await delay(5000);
                let selectedChannel = await mainFrame.$eval('select#adm_channel', sel => sel.value);
                console.log(`Canal aplicado: ${selectedChannel}`);
        
            } catch (error) {
                console.error(`Error al seleccionar el canal ${channel} en el ancho de banda ${bandwidth}:`, error.message);
                continue;
            }
        
            console.log(`Se aplicaron los cambios`);
            await delay(15000);
            await captureScreenshots(page, savePath, channel, bandwidthForName);
        }

        console.log(`Seleccionando configuración automática. Ancho de banda: ${bandwidthForName}...`);
        try {
            await mainFrame.select('select#adm_channel', '0');
            await delay(2000);
            await handleDialog(page);
            await mainFrame.click('input[value="Apply"]');
        } catch (error) {
            console.error(`Error al seleccionar la configuración automática del canal en el ancho de banda ${bandwidth}:`, error.message);
            continue;
        }
        await delay(30000);
        await captureScreenshots(page, savePath, 'auto', bandwidthForName);
    }
}

async function captureScreenshots(page, savePath, channel, bandwidthForName) {
    try {
        // Asegurar que las carpetas existen
        const webPath = path.join(savePath, 'WEB');
        const inssiderPath = path.join(savePath, 'INSSIDER');
        
        if (!fs.existsSync(webPath)) {
            fs.mkdirSync(webPath, { recursive: true });
        }
        if (!fs.existsSync(inssiderPath)) {
            fs.mkdirSync(inssiderPath, { recursive: true });
        }

        // Sanitizar nombres de archivo
        const safeChannel = sanitizeName(channel.toString());
        const safeBandwidth = sanitizeName(bandwidthForName);
        
        const webFilename = `channel_${safeChannel}_${safeBandwidth}.png`;
        const inssiderFilename = `inSSIDer_channel_${safeChannel}_${safeBandwidth}.png`;
        
        console.log(`Guardando capturas en: ${savePath}`);
        console.log(`Archivos: ${webFilename}, ${inssiderFilename}`);
        
        await page.screenshot({ path: path.join(webPath, webFilename) });
        screenshot({ filename: path.join(inssiderPath, inssiderFilename) });
        console.log("Capturas de pantalla (WEB e InSSider) guardadas");
    } catch (error) {
        console.error('Error al guardar las capturas de pantalla:', error.message);
    }
}

async function iterateChannels(mainFrame, finalPath, page, band) {
    // Espera extra para que el contenido de la sección haya cargado completamente
    await delay(1500); // se puede ajustar
    const optionsData = await getBandwidthOptions(mainFrame);
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

    // Crear directorio base si no existe
    try {
        if (!fs.existsSync(baseDir)) {
            fs.mkdirSync(baseDir, { recursive: true });
            console.log(`Directorio base creado: ${baseDir}`);
        }
    } catch (error) {
        console.error(`Error al crear el directorio base ${baseDir}:`, error.message);
        return null;
    }

    // Buscar nombre único
    while (fs.existsSync(finalPath)) {
        folderName = sanitizeName(`Channel_availability_${date}_(${counter++})`);
        finalPath = path.join(baseDir, folderName);
    }

    try {
        fs.mkdirSync(finalPath, { recursive: true });
        console.log(`Las capturas se guardarán en: ${finalPath}`);

        // Crear estructura de 2,4GHz (nombre sanitizado)
        const path24GHz = path.join(finalPath, sanitizeName('2_4GHz'));
        fs.mkdirSync(path24GHz, { recursive: true });

        ['20MHz', '20MHz_40MHz'].forEach(subFolder => {
            const safeSubFolder = sanitizeName(subFolder);
            const subPath = path.join(path24GHz, safeSubFolder);
            fs.mkdirSync(subPath, { recursive: true });
            fs.mkdirSync(path.join(subPath, 'WEB'), { recursive: true });
            fs.mkdirSync(path.join(subPath, 'INSSIDER'), { recursive: true });
        });

        // Crear estructura de 5GHz
        const path5GHz = path.join(finalPath, '5GHz');
        fs.mkdirSync(path5GHz, { recursive: true });

        ['20MHz', '40MHz', '80MHz'].forEach(subFolder => {
            const safeSubFolder = sanitizeName(subFolder);
            const subPath = path.join(path5GHz, safeSubFolder);
            fs.mkdirSync(subPath, { recursive: true });
            fs.mkdirSync(path.join(subPath, 'WEB'), { recursive: true });
            fs.mkdirSync(path.join(subPath, 'INSSIDER'), { recursive: true });
        });

        console.log("Estructura de carpetas creada correctamente.");
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