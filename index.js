
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

// Serve index.css explicitly
app.get('/index.css', (req, res) => {
	res.sendFile(path.join(__dirname, 'public', 'index.css'));
});


// In-memory cache for Notion data
let notionCache = {
	data: null,
	expires: 0
};

// Helper to fetch data from Notion with 15 min cache
async function fetchNotionData() {
	const now = Date.now();
	if (notionCache.data && notionCache.expires > now) {
		return notionCache.data;
	}
	if (!NOTION_TABLE_ID || !NOTION_TOKEN) {
		console.warn('Missing NOTION_TABLE_ID or NOTION_TOKEN');
		return [];
	}
	const notion = new Client({ auth: NOTION_TOKEN });
	try {
		const dbResponse = await notion.databases.retrieve({ database_id: NOTION_TABLE_ID });
		// Fetch pages from the database
		const response = await notion.dataSources.query({ data_source_id: dbResponse.data_sources[0].id });
		// Map Notion response to expected format
		const mapped = response.results.map(page => {
			const props = page.properties;
			const item = {
				name: props["Tên"]?.title?.[0]?.text?.content || '',
				pictureUrl: props["Hình ảnh minh họa"]?.rich_text?.[0]?.text?.content || '',
				disabled: props["Disabled"]?.checkbox || false,
				tags: props["Cái này ăn được trong bữa nào?"]?.multi_select?.map(t => t.name) || [],
				lastEditedTime: page.last_edited_time,
				createdTime: page.created_time
			};
			return item;
		});
		// Cache for 15 minutes
		notionCache.data = mapped;
		notionCache.expires = now + 15 * 60 * 1000;
		return mapped;
	} catch (err) {
		console.error('Error fetching Notion data:', err);
		return [];
	}
}

app.get('/', async (req, res) => {
	// Read index.html
	const htmlPath = path.join(__dirname, 'public', 'index.html');
	let html;
	try {
		html = fs.readFileSync(htmlPath, 'utf8');
	} catch (err) {
		return res.status(500).send('Error loading HTML');
	}
	// Fetch Notion data
	let notionData = await fetchNotionData();
	// Inject data into HTML
	html = html.replace(
		/var notion_data = \[\];/,
		'var notion_data = ' + JSON.stringify(notionData, null, 2) + ';'
	);
	res.send(html);
});

app.listen(PORT, () => {
	console.log(`Server running on http://localhost:${PORT}`);
});
