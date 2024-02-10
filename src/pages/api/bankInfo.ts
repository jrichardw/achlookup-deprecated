// pages/api/bankInfo.ts
import type { NextApiRequest, NextApiResponse } from "next"
import chromium from "chrome-aws-lambda"
import puppeteer from "puppeteer-core"

interface BankData {
	routingNumber: string
	name: string
	city: string
	state: string
}

interface ErrorResponse {
	error: string
}

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse<BankData | ErrorResponse>
) {
	console.log("Request received")
	const { aba } = req.query

	if (typeof aba !== "string") {
		console.log("Invalid ABA routing number format")
		return res
			.status(400)
			.json({ error: "ABA routing number must be a string" })
	}

	console.log("initiating puppeteer")
	let browser = null
	try {
		browser = await puppeteer.launch({
			args: chromium.args,
			executablePath: await chromium.executablePath,
			headless: chromium.headless,
		})
		const page = await browser.newPage()
		await page.goto(
			`https://www.frbservices.org/EPaymentsDirectory/achResults.html?bank=&aba=${aba}`,
			{ waitUntil: "networkidle2" }
		)

		console.log("Page loaded")

		// Check if the "Agree" button exists
		const agreeButton = await page.$("#agree_terms_use")
		if (agreeButton) {
			console.log("Agree button found, clicking...")
			await agreeButton.click()
			// Wait for navigation after clicking the "Agree" button
			await page.waitForNavigation({ waitUntil: "networkidle0" })
			console.log("Navigation after agree completed")
		} else {
			console.log("No agree button found, proceeding with scraping")
		}

		// After navigating past the agreement, scrape the table
		const data: BankData = await page.evaluate(() => {
			console.log("Evaluating page content for data extraction")
			const routingNumber = document
				.querySelector<HTMLElement>("tr#result_row_1 td:nth-child(2)")!
				.innerText.trim()
				.replace(/\D/g, "")
			const name = document
				.querySelector<HTMLElement>("tr#result_row_1 td:nth-child(3)")!
				.innerText.trim()
			const city = document
				.querySelector<HTMLElement>("tr#result_row_1 td:nth-child(4)")!
				.innerText.trim()
			const state = document
				.querySelector<HTMLElement>("tr#result_row_1 td:nth-child(5)")!
				.innerText.trim()
			return { routingNumber, name, city, state }
		})

		console.log("Data extraction successful", data)
		await browser.close()
		res.status(200).json(data)
	} catch (error: any) {
		console.error("An error occurred during data extraction", error)
		if (browser !== null) await browser.close()
		res.status(500).json({ error: "Failed to fetch data" })
	}
}
