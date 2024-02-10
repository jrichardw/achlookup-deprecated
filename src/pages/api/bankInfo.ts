// pages/api/bankInfo.ts
import type { NextApiRequest, NextApiResponse } from "next"
import puppeteer from "puppeteer"

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
	const { aba } = req.query

	if (typeof aba !== "string") {
		return res
			.status(400)
			.json({ error: "ABA routing number must be a string" })
	}

	try {
		const browser = await puppeteer.launch()
		const page = await browser.newPage()
		await page.goto(
			`https://www.frbservices.org/EPaymentsDirectory/achResults.html?bank=&aba=${aba}`,
			{ waitUntil: "networkidle2" }
		)

		console.log("Page loaded")

		// Check if the "Agree" button exists
		const agreeButton = await page.$("#agree_terms_use")
		if (agreeButton) {
			await agreeButton.click()
			console.log("Clicked agree")
			// Wait for navigation after clicking the "Agree" button
			await page.waitForNavigation()
			console.log("Navigated")
		}

		// After navigating past the agreement, scrape the table
		const data: BankData = await page.evaluate(() => {
			console.log("Evaluating")
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

		await browser.close()
		res.status(200).json(data)
	} catch (error) {
		console.error(error)
		//await browser?.close()
		res.status(500).json({ error: "Failed to fetch data" })
	}
}
