/*
Versión mejorada con mejor detección de dependencias y navegador y usa ruta fija en C:.
Modificado: Selección de interfaz al inicio y tiempos de espera aumentados
*/

// ---------- Self-check de dependencias ----------
const { spawnSync } = require('child_process');
const path  = require('path');
const readline = require('readline');

(function ensureDeps() {
  try {
    require.resolve('puppeteer');
    require.resolve('screenshot-desktop');
    return;                              // ← todo OK, continúa ejecución
  } catch { /* nada */ }

  // si ya intentamos una vez en este proceso, abortar
  if (process.env.DEPS_ATTEMPTED) {
    console.error('Las dependencias siguen sin instalarse. Abortando.');
    process.exit(1);
  }

  console.log('Faltan dependencias. Ejecutando install_deps.ps1 …');
  const ps1 = path.join(__dirname, 'install_deps.ps1');
  const code = spawnSync('powershell.exe',
    ['-NoProfile','-ExecutionPolicy','Bypass','-File', ps1],
    { stdio: 'inherit' }
  ).status;

  if (code !== 0) {
    console.error('install_deps.ps1 terminó con error', code);
    process.exit(code);
  }

  // relanza UNA sola vez
  spawnSync(process.argv0, process.argv.slice(1), {
    stdio: 'inherit',
    env: { ...process.env, DEPS_ATTEMPTED: '1' }
  });
  process.exit(0);
})();
//  -------------------------------------------------------------

const puppeteer = require('puppeteer');
const func = require('./mitra_channels_functions.js');

// Función para solicitar selección de interfaz
function askForInterface() {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        console.log('\n================================================');
        console.log('   SELECCIÓN DE INTERFAZ WIFI');
        console.log('================================================\n');
        console.log('¿Qué interfaz desea probar?\n');
        console.log('  1) Solo 2.4 GHz');
        console.log('  2) Solo 5 GHz');
        console.log('  3) Ambas interfaces (2.4 GHz y 5 GHz)\n');
        
        rl.question('Ingrese su opción (1, 2 o 3): ', (answer) => {
            rl.close();
            const option = answer.trim();
            
            if (option === '1') {
                console.log('\n✓ Seleccionado: Solo 2.4 GHz\n');
                resolve('2.4GHz');
            } else if (option === '2') {
                console.log('\n✓ Seleccionado: Solo 5 GHz\n');
                resolve('5GHz');
            } else if (option === '3') {
                console.log('\n✓ Seleccionado: Ambas interfaces\n');
                resolve('both');
            } else {
                console.log('\n⚠ Opción no válida. Ejecutando ambas interfaces por defecto.\n');
                resolve('both');
            }
        });
    });
}

(async () => {
    let browser;
    
    try {
        // Solicitar selección de interfaz al inicio
        const selectedInterface = await askForInterface();
        
        console.log('Iniciando navegador Chromium...');
        
        // Configuración mejorada del navegador
        browser = await puppeteer.launch({
            headless: true,
            defaultViewport: { width: 1366, height: 768 },  // Tamaño de ventana para simular un portátil
            protocolTimeout: 120000,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        });
        
        console.log('Navegador iniciado correctamente.');
        const page = await browser.newPage();

        // Configurar timeouts
        page.setDefaultNavigationTimeout(60000);
        page.setDefaultTimeout(30000);

        if (!(await func.navigateToDeviceWebPage(page))) throw new Error("No se pudo acceder a la página del dispositivo");
        if (!(await func.login(page))) throw new Error("No se pudo iniciar sesión");
        if (!(await func.disableUniqueSSID(page))) throw new Error("No se pudo deshabilitar Unique SSID");
        
        // Ejecutar inSSIDer
        console.log("Preparando el escenario...");
        func.runInSSIDer('"C:\\Program Files (x86)\\MetaGeek\\inSSIDer Home\\inSSIDerHome.exe"');
        await func.delay(2000);
        
        // Obtener SSID
        const ssidValue = await func.getSSID(page);
        if (!ssidValue) {
        console.warn("No se pudo obtener el SSID, continuando sin filtro...");
        }

        //Acceder a la configuración avanzada
        if (!(await func.navigateToAdvancedSettings(page))) throw new Error("No se pudo acceder a configuración avanzada");
        await func.delay(2000);

        // Crear carpeta de trabajo en C:\CapturasCanales
        const finalPath = func.createMainFolder();
        if (!finalPath) throw new Error("No se pudo crear el directorio de trabajo");
        
        await func.delay(2000);

        //Acceder a la configuración de "2,4GHz"
        const CAFrame = page.frames().find(frame => frame.url().includes('monu.asp'));

        // Ejecutar según la selección del usuario
        if (selectedInterface === '2.4GHz' || selectedInterface === 'both') {
            console.log("\n=== INICIANDO CONFIGURACIÓN 2.4GHz ===\n");
            if (!(await func.navigateTo24GHzManagement(CAFrame))) throw new Error("No se pudo acceder a la gestión de 2.4GHz");
            
            // Iterar sobre bandas y canales y capturar pantallas
            const mainFrame24 = page.frames().find(frame => frame.name() === 'mainFrm');

            try {
                console.log("Llamando a iterateChannels para 2.4GHz...");
                await func.iterateChannels(mainFrame24, finalPath, page, "2.4GHz");
                console.log("iterateChannels para 2.4GHz finalizó correctamente.");
            } catch (error) {
                console.error("Error dentro de iterateChannels para 2.4GHz:", error.message);
            }
        } else {
            console.log("\n⏭️  Saltando configuración de 2.4GHz (no seleccionada)\n");
        }

        if (selectedInterface === '5GHz' || selectedInterface === 'both') {
            console.log("\n=== INICIANDO CONFIGURACIÓN 5GHz ===\n");
            
            //Acceder a la configuración de "5GHz"
            if (!(await func.navigateTo5GHzManagement(CAFrame))) throw new Error("No se pudo acceder a la gestión de 5GHz");
                 
            //Iterar sobre bandas y canales y capturar pantallas
            const mainFrame5 = page.frames().find(frame => frame.name() === 'mainFrm');
            
            try {
                console.log("Llamando a iterateChannels para 5GHz...");
                await func.iterateChannels(mainFrame5, finalPath, page, "5GHz");
                console.log("iterateChannels para 5GHz finalizó correctamente.");
            } catch (error) {
                console.error("Error dentro de iterateChannels para 5GHz:", error.message);
            }
        } else {
            console.log("\n⏭️  Saltando configuración de 5GHz (no seleccionada)\n");
        }

        console.log("Script completado exitosamente.");
        console.log("================================================");
        console.log("TODAS LAS CAPTURAS SE GUARDARON EN:");
        console.log(finalPath);
        console.log("================================================");

    } catch (error) {
        console.error("Error durante la ejecución:", error.message);
        
        // Diagnóstico adicional para errores de Chromium
        if (error.message.includes('Could not find Chromium') || 
            error.message.includes('Failed to launch') ||
            error.message.includes('spawn ENOENT')) {
            console.error("\n=== DIAGNÓSTICO DE CHROMIUM ===");
            console.error("Parece que hay un problema con la instalación de Chromium.");
            console.error("Soluciones sugeridas:");
            console.error("1. Ejecuta: npx puppeteer browsers install chrome");
            console.error("2. O ejecuta: node -e \"require('puppeteer').launch().then(() => console.log('OK'))\"");
            console.error("3. Verifica que no hay restricciones de firewall/antivirus");
            console.error("================================\n");
        }
        
        process.exit(1);
    } finally {
        if (browser) {
            try {
                await browser.close();
                console.log("Navegador cerrado correctamente.");
            } catch (error) {
                console.error("Error al cerrar el navegador:", error.message);
            }
        }
    }
})();