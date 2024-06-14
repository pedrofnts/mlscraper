const puppeteer = require("puppeteer");
const fs = require("fs");

async function scrapeElectrolux() {
  const browser = await puppeteer.launch({ headless: true }); // headless mode
  const page = await browser.newPage();

  const baseUrl =
    "https://lista.mercadolivre.com.br/eletrodomesticos/electrolux_BRAND_188_NoIndex_True";
  let currentPage = 1;
  const itemsPerPage = 50; // Update based on the actual number of items per page on the website
  let allProducts = [];
  let isFirstProduct = true;

  while (true) {
    const desde = (currentPage - 1) * itemsPerPage + 1;
    const searchUrl =
      currentPage === 1 ? `${baseUrl}` : `${baseUrl}_Desde_${desde}`;
    await page.goto(searchUrl, { waitUntil: "networkidle2" });

    // Extract product data from the current page
    const productLinks = await page.evaluate(() => {
      return Array.from(
        document.querySelectorAll(".ui-search-item__title a")
      ).map((link) => link.href);
    });

    for (const link of productLinks) {
      try {
        await page.goto(link, { waitUntil: "networkidle2", timeout: 30000 });

        const productDetails = await page.evaluate(() => {
          const getTextContent = (xpath) => {
            const element = document.evaluate(
              xpath,
              document,
              null,
              XPathResult.FIRST_ORDERED_NODE_TYPE,
              null
            ).singleNodeValue;
            return element ? element.textContent.trim() : "N/A";
          };

          const title =
            document.querySelector("h1.ui-pdp-title")?.innerText || "N/A";

          let price = "N/A";
          let originalPrice = "N/A";
          let isPromotion = false;

          // Verifique se há um preço promocional
          const promoPriceElement = document.evaluate(
            '//*[contains(concat( " ", @class, " " ), concat( " ", "andes-money-amount__cents--superscript-36", " " ))] | //*[contains(concat( " ", @class, " " ), concat( " ", "ui-pdp-price__second-line", " " ))]//*[contains(concat( " ", @class, " " ), concat( " ", "andes-money-amount__fraction", " " ))]',
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
          ).singleNodeValue;

          if (promoPriceElement) {
            price = promoPriceElement.innerText.trim();
            isPromotion = true;
          }

          if (isPromotion) {
            // Se estiver em promoção, obtenha o preço original
            const originalPriceElement = document.evaluate(
              '//*[contains(concat( " ", @class, " " ), concat( " ", "andes-money-amount--previous", " " ))]//*[contains(concat( " ", @class, " " ), concat( " ", "andes-money-amount__fraction", " " ))]',
              document,
              null,
              XPathResult.FIRST_ORDERED_NODE_TYPE,
              null
            ).singleNodeValue;
            if (originalPriceElement) {
              originalPrice = originalPriceElement.innerText.trim();
            }
          } else {
            // Se não estiver em promoção, o preço atual é o preço normal
            originalPrice = price;
          }

          const sales = getTextContent(
            '//*[contains(concat( " ", @class, " " ), concat( " ", "ui-pdp-subtitle", " " ))]'
          );
          const purchaseOptions =
            Array.from(document.querySelectorAll(".ui-pdp-products__link"))
              .map((option) => option.innerText)
              .join(", ") || "N/A";
          const rating = getTextContent(
            '//*[contains(concat( " ", @class, " " ), concat( " ", "ui-pdp-review__rating", " " ))]'
          );
          const ratingCount = getTextContent(
            '//*[contains(concat( " ", @class, " " ), concat( " ", "ui-pdp-review__amount", " " ))]'
          );

          return {
            title,
            price,
            originalPrice,
            sales,
            purchaseOptions,
            rating,
            ratingCount,
            link: window.location.href,
          };
        });

        allProducts.push(productDetails);
        console.log(`Scraped product: ${productDetails.title}`);

        // Save the product immediately
        saveToCSV([productDetails], "Electrolux_Products.csv", isFirstProduct);
        isFirstProduct = false;

        await page.goBack({ waitUntil: "networkidle2", timeout: 30000 });
      } catch (error) {
        console.error(`Error scraping product at ${link}:`, error);
        continue; // Skip this product and continue with the next one
      }
    }

    // Check if there is a next page
    if (productLinks.length < itemsPerPage) {
      break;
    }

    currentPage++;
  }

  await browser.close();
  console.log("Scraping completed and data saved to Electrolux_Products.csv");
}

function saveToCSV(products, fileName, isFirstProduct = false) {
  try {
    const csv = products
      .map((product) => [
        product.title,
        product.price,
        product.originalPrice,
        product.sales,
        product.purchaseOptions,
        product.rating,
        product.ratingCount,
        product.link,
      ])
      .map((row) => row.join(","))
      .join("\n");

    if (isFirstProduct) {
      const header = [
        "title",
        "price",
        "originalPrice",
        "sales",
        "purchaseOptions",
        "rating",
        "ratingCount",
        "link",
      ].join(",");
      fs.writeFileSync(fileName, header + "\n" + csv);
    } else {
      fs.appendFileSync(fileName, "\n" + csv);
    }
  } catch (error) {
    console.error("Error while saving to CSV:", error);
  }
}

scrapeElectrolux().catch((err) => console.error("Error:", err));
