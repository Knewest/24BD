param(
    [Parameter(Mandatory=$true)]
    [string]$inputFile,
    
    [Parameter(Mandatory=$true)]
    [string]$outputFile
)

try {
    # Get the script directory.
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $ffprobePath = "$scriptDir\ffprobe.exe"
    $ffmpegPath = "$scriptDir\ffmpeg.exe"
    $tsMuxeRPath = "$scriptDir\tsMuxeR.exe"

    # Path setup.
    $basePath = Split-Path -Parent $inputFile

    Write-Output "DEMUXING VIDEO AND AUDIO..."

    # Demux the video and audio.
    & "$ffmpegPath" -i "$inputFile" -map 0:v -c copy "$basePath\24BD_video.h264" -map 0:1 -c pcm_s16le "$basePath\24BD_audio.wav"

    Write-Output "PREPARING TO REMUX VIDEO TO 24FPS..."

    # Create a meta file for tsMuxeR.
    $metaContent = @"
MUXOPT --demux, fps=24
V_MPEG4/ISO/AVC, "$basePath\24BD_video.h264", fps=24
"@
    Set-Content -Path "$basePath\24BD_video.meta" -Value $metaContent

    # Run tsMuxeR.
    & "$tsMuxeRPath" "$basePath\24BD_video.meta" "$basePath\24BD_output_video.m2ts"

    # Clean up.
    Remove-Item "$basePath\24BD_video.meta"
    Remove-Item "$basePath\24BD_video.h264"

    Write-Output "CALCULATING TEMPO TO MATCH AUDIO WITH VIDEO..."

    # Get durations.
    $videoDuration = & "$ffprobePath" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$basePath\24BD_output_video.m2ts"
    $audioDuration = & "$ffprobePath" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$basePath\24BD_audio.wav"

    # Make sure we got the durations correctly, if not - throw an exception.
    if ($null -eq $videoDuration -or $null -eq $audioDuration) {
        throw "Could not retrieve video and/or audio duration"
    }

    # Calculate tempo (I hate math).
    $tempo = $audioDuration / $videoDuration

    # Check tempo boundaries and adjust if necessary (probably always necessary).
    if ($tempo -lt 0.5) {
        $tempo = 0.5
    } elseif ($tempo -gt 2.0) {
        $tempo = 2.0
    }

    Write-Output "SYNCING AUDIO TO VIDEO..."
    
    # Adjust the audio speed.
    & "$ffmpegPath" -i "$basePath\24BD_audio.wav" -filter:a "atempo=$tempo" "$basePath\24BD_audio_adjusted.wav"

    # Clean up.
    Remove-Item "$basePath\24BD_audio.wav"

    Write-Output "REMUXING VIDEO AND AUDIO TOGETHER..."
    
    # Merge the audio and video.
    & "$ffmpegPath" -i "$basePath\24BD_output_video.m2ts" -i "$basePath\24BD_audio_adjusted.wav" -c copy "$outputFile"

    # Clean up.
    Remove-Item "$basePath\24BD_output_video.m2ts"
    Remove-Item "$basePath\24BD_audio_adjusted.wav"
} catch {
    Write-Error "Error in processing the video: $_"
}


#
# Version 1.1 of 24BD
# Copyright (Boost Software License 1.0) 2023-2023 Knew
# Link to software: https://github.com/Knewest/24BD
# 