/*
Versión actualizada para Mitra con selectores correctos
Itera por bandas y canales usando los selectores reales del router
*/

// ---------- Self-check de dependencias ----------
const { spawnSync } = require('child_process');
const path  = require('path');
const readline = require('readline');

(function ensureDeps() {
  try {
    require.resolve('puppeteer');
    require.resolve('screenshot-desktop');
    return;
  } catch { /* nada */ }

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
        
        browser = await puppeteer.launch({
            headless: true,
            defaultViewport: { width: 1366, height: 768 },
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

        // Acceder a la configuración avanzada
        if (!(await func.navigateToAdvancedSettings(page))) throw new Error("No se pudo acceder a configuración avanzada");
        await func.delay(2000);

        // Crear carpeta de trabajo
        const finalPath = func.createMainFolder();
        if (!finalPath) throw new Error("No se pudo crear el directorio de trabajo");
        
        await func.delay(2000);

        // ========== CONFIGURACIÓN 2.4GHz ==========
        if (selectedInterface === '2.4GHz' || selectedInterface === 'both') {
            console.log("\n=== INICIANDO CONFIGURACIÓN 2.4GHz ===\n");
            
            if (!(await func.navigateTo24GHzManagement(page))) {
                throw new Error("No se pudo acceder a la gestión de 2.4GHz");
            }
            
            await func.delay(2000);
            
            // Encontrar el mainFrame después de estar en Advanced
            const mainFrame24 = page.frames().find(frame => 
                frame.url().includes('wlan_others.cgi')
            );

            if (!mainFrame24) {
                console.error("❌ No se encontró mainFrame para 2.4GHz (wlan_others.cgi)");
                console.log("Frames disponibles:");
                page.frames().forEach(f => console.log(`  - ${f.url()}`));
            } else {
                try {
                    console.log("✓ mainFrame encontrado para 2.4GHz");
                    console.log("Llamando a iterateChannels para 2.4GHz...");
                    await func.iterateChannels(mainFrame24, finalPath, page, "2.4GHz");
                    console.log("✓ iterateChannels para 2.4GHz finalizó correctamente.");
                } catch (error) {
                    console.error("❌ Error dentro de iterateChannels para 2.4GHz:", error.message);
                    console.error(error.stack);
                }
            }
        } else {
            console.log("\n⏭️  Saltando configuración de 2.4GHz (no seleccionada)\n");
        }

        // ========== CONFIGURACIÓN 5GHz ==========
        if (selectedInterface === '5GHz' || selectedInterface === 'both') {
            console.log("\n=== INICIANDO CONFIGURACIÓN 5GHz ===\n");
            
            if (!(await func.navigateTo5GHzManagement(page))) {
                throw new Error("No se pudo acceder a la gestión de 5GHz");
            }
            
            await func.delay(2000);
            
            // Encontrar el mainFrame después de estar en Advanced
            const mainFrame5 = page.frames().find(frame => 
                frame.url().includes('wlan5_others.cgi')
            );
            
            if (!mainFrame5) {
                console.error("❌ No se encontró mainFrame para 5GHz (wlan5_others.cgi)");
                console.log("Frames disponibles:");
                page.frames().forEach(f => console.log(`  - ${f.url()}`));
            } else {
                try {
                    console.log("✓ mainFrame encontrado para 5GHz");
                    console.log("Llamando a iterateChannels para 5GHz...");
                    await func.iterateChannels(mainFrame5, finalPath, page, "5GHz");
                    console.log("✓ iterateChannels para 5GHz finalizó correctamente.");
                } catch (error) {
                    console.error("❌ Error dentro de iterateChannels para 5GHz:", error.message);
                    console.error(error.stack);
                }
            }
        } else {
            console.log("\n⏭️  Saltando configuración de 5GHz (no seleccionada)\n");
        }

        console.log("\n================================================");
        console.log("✓✓✓ Script completado exitosamente ✓✓✓");
        console.log("================================================");
        console.log("TODAS LAS CAPTURAS SE GUARDARON EN:");
        console.log(finalPath);
        console.log("================================================\n");

    } catch (error) {
        console.error("\n❌ Error durante la ejecución:", error.message);
        console.error(error.stack);
        
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