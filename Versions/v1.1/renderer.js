document.addEventListener('DOMContentLoaded', (event) => {

let processingInterval;
let processingStartTime;
let processButton = document.getElementById('processButton');
let loadingWebP = document.getElementById('loadingWebP');
let loadingWebP2 = document.getElementById('loadingWebP2');

const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const { exec } = require('child_process');

const ffprobePath = path.join(__dirname, 'ffprobe.exe');
const ffmpegPath = path.join(__dirname, 'ffmpeg.exe');

async function deleteIfExists(filePath) {
    try {
        await fs.unlink(filePath);
    } catch (err) {
        if (err.code !== 'ENOENT') throw err;
    }
}

document.getElementById('fileInput').addEventListener('change', async function() {

        const fileNameDisplay = document.getElementById('selectedFileName');
        if (this.files && this.files[0]) {
            fileNameDisplay.textContent = this.files[0].name;
        } else {
            fileNameDisplay.textContent = 'NO FILE SELECTED...';
        }

    const filePath = this.files[0].path;
    const pngOutputPath = path.join(__dirname, 'thumbnail.png');
    const avifOutputPath = path.join(__dirname, 'thumbnail.avif');
    const loadingThumbnailBox = document.querySelector('.loadingThumbnailBox');
    await Promise.all([deleteIfExists(pngOutputPath), deleteIfExists(avifOutputPath)]);
    
    // Delete any pre-existing thumbnails.
    deleteIfExists(pngOutputPath);
    deleteIfExists(avifOutputPath);

    // Use FFprobe to get video duration.
    exec(`"${ffprobePath}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error fetching video duration: ${error.message}`);
            return;
        }

        const duration = parseFloat(stdout.trim()); // Duration of the video in seconds.
        const thumbnailTime = duration * 0.45; // 45% of the way through the video.

        // Extract frame using FFmpeg.
        exec(`"${ffmpegPath}" -ss ${thumbnailTime} -i "${filePath}" -vframes 1 "${pngOutputPath}"`, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error extracting thumbnail: ${error.message}`);
                return;
            }
                sharp(pngOutputPath)
                    .resize(1280)  // Resize the thumbnail.
                    .avif({ quality: 95 })
                    .toFile(avifOutputPath, (err, info) => {
                        if (err) {
                            console.log(`Error converting to AVIF: ${err.message}`);
                            return;
                        }

                    // Show the thumbnail and hide the loading icon.
                    loadingWebP.style.display = 'none';
                    document.getElementById('videoThumbnail').src = avifOutputPath + "?" + new Date().getTime();
                    document.getElementById('videoThumbnail').style.display = 'block';

                    // Delete PNG thumbnail after it's no longer needed. Delete this line for a lossless copy.
                    deleteIfExists(pngOutputPath);
            });
        });
    });
    // Show loading box and icon.
    loadingThumbnailBox.style.display = 'block';
    loadingWebP.style.display = 'block';
    document.getElementById('videoThumbnail').style.display = 'none';
});

async function promptForFilename() {
    return new Promise((resolve, reject) => {
        const outputModal = document.getElementById('outputModal');
        const confirmButton = document.getElementById('confirmOutputBtn');
        const cancelButton = document.getElementById('cancelOutputBtn');
        
        // Display the modal.
        outputModal.style.display = 'block';

        function handleConfirmClick() {
            const outputFileName = document.getElementById('outputFileName').value.trim();
            let outputFileExt = document.getElementById('outputFileExt').value.trim();

            // Validate the file name and extension.
            if (!outputFileName) {
                alert("Please enter a file name.");
                return;
            }

            if (!outputFileExt) {
                alert("Please enter a file extension.");
                return;
            }

            // Make sure extension starts with a dot, if not add it.
            if (!outputFileExt.startsWith('.')) {
                outputFileExt = '.' + outputFileExt;
            }

            // Construct the full file name and resolve the promise.
            const fullOutputPath = `${outputFileName}${outputFileExt}`;
            resolve(fullOutputPath);

            // Clean up by hiding the modal and removing the event listeners.
            outputModal.style.display = 'none';
            confirmButton.removeEventListener('click', handleConfirmClick);
            cancelButton.removeEventListener('click', handleCancelClick);
        }

        function handleCancelClick() {
            // Reject the promise if the user cancels the action.
            reject(new Error('User cancelled the file naming.'));

            // Clean up by hiding the modal and removing the event listeners.
            outputModal.style.display = 'none';
            confirmButton.removeEventListener('click', handleConfirmClick);
            cancelButton.removeEventListener('click', handleCancelClick);
        }

        // Add event listeners for the buttons.
        confirmButton.addEventListener('click', handleConfirmClick);
        cancelButton.addEventListener('click', handleCancelClick);
    });
}

function updateStage(message) {
    let currentStage = document.getElementById('currentStage');
    if (currentStage) {
        currentStage.innerText = message;
    }
}

function resetStatus() {
    document.getElementById('status').innerText = "　";
}

processButton.addEventListener('click', async () => {
    
    const filePath = document.getElementById('fileInput').files[0].path;
    
    const outputFile = await promptForFilename();  
    if (!outputFile) {
        console.error('User did not provide an output filename.');
        return;
    }

    const inputDir = path.dirname(filePath);
    const fullOutputPath = path.join(inputDir, outputFile);    
    const scriptPath = path.join(__dirname, 'process.ps1');

    // Disable the button.
    processButton.disabled = true;

    // Show the loading WebP.
    loadingWebP2.style.display = 'block';

    processingStartTime = Date.now();

    document.querySelector('.discWrapper').classList.add('processing');

    const process = exec(`pwsh -File "${scriptPath}" -inputFile "${filePath}" -outputFile "${fullOutputPath}"`, { maxBuffer: 10 * 1024 * 1024 });

    process.stdout.on('data', function(data) {
        // Update the status based on the stdout from the PowerShell script.
        updateStage(data.trim());
    });
    
    // Inside the processButton click event handler
    process.on('close', function(code) {
        clearInterval(processingInterval);

        // Enable the button again.
        processButton.disabled = false;

        // Hide the loading WebP.
        loadingWebP2.style.display = 'none';

        if (code !== 0) {
            console.log(`PROCESS EXITED WITH CODE: "${code}".`);
            document.getElementById('processingStatus').innerText = `ERROR: PROCESS EXITED WITH CODE "${code}"`;
        } else {
            console.log(`PROCESS COMPLETED SUCCESSFULLY.`);
            document.getElementById('processingStatus').innerText = "SUCCESS: FOOTAGE HAS BEEN CORRECTED TO 24000/1000 (24FPS)";
            
            // Set a delay to revert the status back to IDLE after infinite seconds. This is just here for debug reasons.
            setTimeout(resetStatus, 1000000000);
        } 

        document.querySelector('.discWrapper').classList.remove('processing');

    });

    let dots = '';
    processingInterval = setInterval(() => {
        dots = dots.length < 3 ? dots + '.' : '';
        const elapsedSeconds = Math.floor((Date.now() - processingStartTime) / 1000);
        document.getElementById('processingStatus').innerText = `PROCESSING${dots}`;
        document.getElementById('elapsedTime').innerText = `－ TOTAL SECONDS ELAPSED: ${elapsedSeconds} －`;
    }, 1000);    
});

});


/*
# Version 1.1 of 24BD
# Copyright (Boost Software License 1.0) 2023-2023 Knew
# Link to software: https://github.com/Knewest/24BD
*/