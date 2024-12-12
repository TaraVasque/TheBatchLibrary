const axios = require('axios');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Create an HTTPS agent to bypass certificate verification
const agent = new https.Agent({  
  rejectUnauthorized: false  // Disables certificate verification for this request
});

// GitHub Personal Access Token (if needed for rate limiting)
const GITHUB_TOKEN = 'YOUR_GITHUB_TOKEN';  // Replace with your token or leave empty for public access
const HEADERS = { Authorization: `token ${GITHUB_TOKEN}` };

// GitHub API URL for searching files
const GITHUB_API_URL = 'https://api.github.com/search/code';

// Set to store the hashes of collected files (to filter duplicates)
let collectedHashes = new Set();

// Stats
let totalDownloadTime = 0;  // in milliseconds
let totalFilesDownloaded = 0;
let totalDuplicatesFound = 0;
let totalLatency = 0; // in milliseconds
let totalFilesProcessed = 0;

// Function to calculate the SHA-256 hash of file content
function getFileHash(content) {
  const hash = crypto.createHash('sha256');
  hash.update(content);
  return hash.digest('hex');
}

// Function to search for .bat files on GitHub
async function searchBatchScripts(query = 'extension:bat') {
  let page = 1;
  let files = [];

  while (true) {
    const url = `${GITHUB_API_URL}?q=${query}&page=${page}&per_page=100}`;
    const startTime = Date.now(); // Track latency

    try {
      const response = await axios.get(url, { headers: HEADERS, httpsAgent: agent });
      const data = response.data;
      const latency = Date.now() - startTime; // Latency calculation
      totalLatency += latency;

      if (!data.items || data.items.length === 0) {
        break;  // Exit if no more .bat files are found
      }

      // Collect file data
      for (const item of data.items) {
        const fileData = {
          repository: item.repository.full_name,
          file_name: item.name,
          file_url: item.html_url,
          download_url: item.download_url
        };
        files.push(fileData);
      }
      page++;
    } catch (error) {
      console.error(`Error fetching data from GitHub: ${error.message}`);
      break;
    }
  }

  return files;
}

// Function to download .bat file content and check for duplicates
async function downloadFile(url, savePath) {
  const startDownloadTime = Date.now();  // Track the download time

  try {
    const response = await axios.get(url, { responseType: 'arraybuffer', httpsAgent: agent });
    const downloadTime = Date.now() - startDownloadTime;
    totalDownloadTime += downloadTime; // Add the download time to the total

    // Get the file content as a buffer
    const content = Buffer.from(response.data);
    const fileHash = getFileHash(content);

    // Check if the file's hash has already been collected
    if (collectedHashes.has(fileHash)) {
      totalDuplicatesFound++;
      console.log(`Duplicate found, skipping ${savePath}`);
    } else {
      // Save the file to disk
      fs.writeFileSync(savePath, content);
      collectedHashes.add(fileHash);
      totalFilesDownloaded++;
      console.log(`Downloaded ${savePath}`);
    }

  } catch (error) {
    console.error(`Failed to download file from ${url}: ${error.message}`);
  }
}

// Function to collect and download unique .bat files
async function collectBatchFiles() {
  const batchFiles = await searchBatchScripts();

  if (!fs.existsSync('bat_files')) {
    fs.mkdirSync('bat_files');  // Create bat_files directory if it doesn't exist
  }

  for (const file of batchFiles) {
    const fileName = file.file_name;
    const downloadUrl = file.download_url;

    if (downloadUrl) {
      const savePath = path.join('bat_files', fileName);
      totalFilesProcessed++;  // Increment total files processed
      await downloadFile(downloadUrl, savePath);
    } else {
      console.log(`Skipping ${fileName} (no download URL)`);
    }
  }

  // After processing, generate a markdown report
  generateMarkdownReport();
}

// Function to generate markdown report with stats
function generateMarkdownReport() {
  const averageDownloadTime = totalFilesDownloaded > 0 ? (totalDownloadTime / totalFilesDownloaded).toFixed(2) : 0;
  const averageLatency = totalFilesProcessed > 0 ? (totalLatency / totalFilesProcessed).toFixed(2) : 0;

  const markdownReport = `
# Batch Files Collection Report

## Stats:
- **Total Files Processed**: ${totalFilesProcessed}
- **Total Files Downloaded**: ${totalFilesDownloaded}
- **Total Duplicates Found**: ${totalDuplicatesFound}
- **Total Download Time**: ${totalDownloadTime} ms
- **Average Download Time per File**: ${averageDownloadTime} ms
- **Total Latency**: ${totalLatency} ms
- **Average Latency per Request**: ${averageLatency} ms

## Notes:
- Always review the code of any downloaded batch files before executing them. Some files may contain harmful code.
  `;

  fs.writeFileSync('bat_files/collection_report.md', markdownReport);
  console.log('Generated Markdown Report: bat_files/collection_report.md');
}

collectBatchFiles().catch(error => {
  console.error(`Error collecting batch files: ${error.message}`);
});
