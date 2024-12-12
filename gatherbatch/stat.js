const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const { execSync } = require('child_process');

// GitHub API URL for uploading files
const GITHUB_API_URL = 'https://api.github.com/repos';
const GITHUB_TOKEN = 'GITHUBTOKEN'; // Replace with your GitHub token
const OWNER = 'USERNAME'; // GitHub username or organization
const REPO = 'YOUR_REPO_NAME'; // GitHub repository name
const COMMIT_MESSAGE = 'Add all files from local directory';

// Directory containing the files you want to upload
const DIRECTORY_PATH = '.';  // The current directory

// Headers for authentication
const HEADERS = {
  Authorization: `token ${GITHUB_TOKEN}`,
  'Content-Type': 'application/json',
};

// Function to get the list of files in the directory
function getFilesInDirectory(directoryPath) {
  return fs.readdirSync(directoryPath).map(file => path.join(directoryPath, file));
}

// Function to upload a file to GitHub repository
async function uploadFileToGitHub(filePath, commitMessage) {
  const fileName = path.basename(filePath);
  const fileContent = fs.readFileSync(filePath, { encoding: 'base64' });
  const filePathInRepo = fileName;  // Change this to the desired path in the repo if needed

  const data = {
    message: commitMessage,
    content: fileContent,  // Base64 encoded content
  };

  try {
    const response = await axios.put(
      `${GITHUB_API_URL}/${OWNER}/${REPO}/contents/${filePathInRepo}`,
      data,
      { headers: HEADERS }
    );

    console.log(`Successfully uploaded ${fileName}`);
    return response.data;
  } catch (error) {
    console.error(`Error uploading ${fileName}: ${error.message}`);
  }
}

// Function to commit all files in the directory to GitHub repository
async function commitAllFilesToGitHub() {
  const files = getFilesInDirectory(DIRECTORY_PATH);
  let filesUploaded = 0;

  // Loop through all the files in the directory and upload them
  for (const file of files) {
    // Skip directories
    if (fs.lstatSync(file).isDirectory()) continue;

    const result = await uploadFileToGitHub(file, COMMIT_MESSAGE);
    if (result) {
      filesUploaded++;
    }
  }

  console.log(`${filesUploaded} files were successfully uploaded to GitHub.`);
}

// Initialize git and commit all files
async function gitCommitAndPush() {
  try {
    // Initialize Git and commit the changes
    execSync('git init'); // Initializes git repo if not already done
    execSync('git add .'); // Stage all files
    execSync('git commit -m "Add all files"'); // Commit files
    execSync('git push origin main'); // Push to GitHub (make sure 'main' is the default branch)
    console.log('Changes pushed to GitHub.');
  } catch (error) {
    console.error('Git commit/push failed:', error.message);
  }
}

// Main function to call the upload and git commit/push process
async function main() {
  try {
    await commitAllFilesToGitHub();
    await gitCommitAndPush();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
