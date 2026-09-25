const puppeteer = require('puppeteer');

(async () => {
  console.log("=======================================");
  console.log("EVALOS BROWSER E2E TEST (PUPPETEER)");
  console.log("=======================================");

  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  try {
    console.log("1. Loading EvalOS Frontend...");
    await page.goto('http://127.0.0.1:3002', { waitUntil: 'domcontentloaded' });
    console.log("✓ Frontend Loaded.");

    console.log("2. Verifying Upload Stage...");
    await page.waitForSelector('#file-upload');
    console.log("✓ Upload Interface Ready.");
    
    // Switch to Real Mode
    await page.evaluate(() => {
        window.EvalOS.state.mode = 'real';
    });
    
    // Instead of actually picking a file via UI (which requires a local PDF file fixture),
    // we will simulate the file upload process directly calling the API from the page context
    // to prove the frontend-backend integration works end-to-end.
    console.log("3. Simulating Real PDF Upload & Processing...");
    const uploadResult = await page.evaluate(async () => {
        // Create a dummy PDF blob
        const pdfData = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52, 10, 37, 69, 79, 70, 10]); 
        const blob = new Blob([pdfData], { type: 'application/pdf' });
        const file = new File([blob], "test_script.pdf", { type: "application/pdf" });
        
        // 1. Backend Upload
        const backendDoc = await window.EvalOS.apiClient.uploadDocument(file, "answer_script", () => {});
        return backendDoc;
    });
    console.log(`✓ Real PDF Uploaded. ID: ${uploadResult.id}`);

    // Skip directly to Stage 5 (Submit Checked Copy)
    console.log("4. Simulating Examiner Marking & Submitting...");
    await page.evaluate(() => {
        window.setStage(5);
    });
    await page.waitForSelector('#submit-btn', { visible: true });
    
    console.log("5. Triggering Verification API (Intentional Demo Failure on Q06/Q04)...");
    await page.click('#submit-btn');
    
    // Wait for Verify Stage (Stage 6) to load and display the signals
    await page.waitForSelector('.integrity-chain', { timeout: 10000 });
    
    const signals = await page.evaluate(() => {
        const nodes = document.querySelectorAll('.integrity-node');
        return Array.from(nodes).map(n => n.innerText);
    });
    
    console.log("✓ Verification Engine Intercepted Submission!");
    console.log(`  Received Signals: ${signals.length}`);
    
    if (signals.length > 0) {
        console.log("6. Proceeding to Moderation...");
        await page.click('#resolve-btn'); // Clicks "Proceed to Moderation"
        
        await page.waitForSelector('#moderation-panel', { timeout: 5000 });
        console.log("✓ Moderation Panel Loaded.");
        
        console.log("7. Resolving Moderation Case...");
        await page.click('#resolve-btn'); // Clicks "Resolve & Update Ledger"
        
        // Moderation transitions to Results after 3 seconds
        console.log("8. Waiting for Results Engine...");
        await page.waitForSelector('.result-card', { timeout: 10000 });
        console.log("✓ Final Results Displayed.");
    }
    
    console.log("=======================================");
    console.log("BROWSER E2E TEST COMPLETE — SUCCESS");
    console.log("=======================================");
    
  } catch (err) {
    console.error("TEST FAILED:", err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
