(function() {
    const { ipcRenderer } = require('electron');
    const fs = require('fs');
    const sharp = require('sharp');
    const path = require('path');
    const ffmpeg = require('fluent-ffmpeg');
    
    document.getElementById('fileInput').addEventListener('change', async function (event) {
        let filePath = this.files[0].path;
        let fileExtension = path.extname(filePath);
    
        if (fileExtension === '.mkv' || fileExtension === '.mp4') {
            let thumbnailPath = path.join(await ipcRenderer.invoke('get-app-path'), '24BD', 'thumbnail.avif');
    
            ffmpeg(filePath)
                .screenshots({
                    timestamps: ['50%'],
                    filename: 'thumbnail.png',
                    folder: await ipcRenderer.invoke('get-app-path')
                });
    
            await sharp(await ipcRenderer.invoke('get-app-path') + '/thumbnail.png')
                .avif()
                .toFile(thumbnailPath);
                
            fs.unlinkSync(await ipcRenderer.invoke('get-app-path') + '/thumbnail.png');
            document.getElementById('videoThumbnail').src = thumbnailPath;
        }
    });    
})();