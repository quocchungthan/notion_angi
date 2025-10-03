
// Load environment variables
require('dotenv').config();
console.log('Loaded environment variables:', {
	NOTION_TABLE_ID: process.env.NOTION_TABLE_ID,
	NOTION_TOKEN: process.env.NOTION_TOKEN_ANGI ? '[REDACTED]' : undefined,
	PORT: process.env.PORT
});

const express = require('express');
const fs = require('fs');
const path = require('path');
const { Client } = require('@notionhq/client');

const NOTION_TABLE_ID = process.env.NOTION_TABLE_ID;
const NOTION_TOKEN = process.env.NOTION_TOKEN_ANGI;

const app = express();
const PORT = process.env.PORT || 3000;

// Helper to fetch data from Notion
async function fetchNotionData() {
	if (!NOTION_TABLE_ID || !NOTION_TOKEN) {
		console.warn('Missing NOTION_TABLE_ID or NOTION_TOKEN');
		return [];
	}
	console.log('Initializing Notion client...');
	const notion = new Client({ auth: NOTION_TOKEN });
	try {
		console.log('Querying Notion database for pages:');
		const dbResponse = await notion.databases.retrieve({ database_id: NOTION_TABLE_ID });
		console.log('Database info:', dbResponse.data_sources[0]);
		// Fetch pages from the database
		const response = await notion.dataSources.query({ data_source_id: dbResponse.data_sources[0].id });
		console.log('Raw Notion query response:', JSON.stringify(response, null, 2));
		// Map Notion response to expected format
		const mapped = response.results.map(page => {
			const props = page.properties;
			const item = {
				name: props["Name"]?.title?.[0]?.text?.content || '',
				pictureUrl: props["Picture Link"]?.rich_text?.[0]?.text?.content || '',
				disabled: props["Disabled"]?.checkbox || false,
				tags: props["Types"]?.multi_select?.map(t => t.name) || [],
				lastEditedTime: page.last_edited_time,
				createdTime: page.created_time
			};
			console.log('Mapped Notion item:', item);
			return item;
		});
		console.log('Final mapped Notion data:', mapped);
		return mapped;
	} catch (err) {
		console.error('Error fetching Notion data:', err);
		return [];
	}
}

app.get('/', async (req, res) => {
	console.log('Received GET / request');
	// Read index.html
	const htmlPath = path.join(__dirname, 'public', 'index.html');
	console.log('Reading HTML file:', htmlPath);
	let html;
	try {
		html = fs.readFileSync(htmlPath, 'utf8');
		console.log('HTML file loaded');
	} catch (err) {
		console.error('Error reading HTML file:', err);
		return res.status(500).send('Error loading HTML');
	}
	// Fetch Notion data
	let notionData = await fetchNotionData();
	console.log('Injecting Notion data into HTML:', notionData);
	// Inject data into HTML
	html = html.replace(
		/var notion_data = \[\];/,
		'var notion_data = ' + JSON.stringify(notionData, null, 2) + ';'
	);
	res.send(html);
	console.log('Response sent to client');
});

app.listen(PORT, () => {
	console.log(`Server running on http://localhost:${PORT}`);
});
