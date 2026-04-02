const pool = require('../db/pool');
const fmpService = require('./fmp');
const forexService = require('./forex');

async function getHoldingsForUser(userId, accountType) {
    let query = `
        SELECT h.*, p.account_type, p.name as portfolio_name
        FROM holdings h
        JOIN portfolios p ON h.portfolio_id = p.id
        WHERE p.user_id = $1
    `;
    const params = [userId];
    if (accountType && accountType !== 'All') {
        query += ' AND p.account_type = $2';
        params.push(accountType);
    }
    query += ' ORDER BY h.ticker';
    const result = await pool.query(query, params);
    return result.rows;
}

async function getHoldingsWithDividends(userId, accountType) {
    const holdings = await getHoldingsForUser(userId, accountType);
    if (holdings.length === 0) return [];

    const usdCadRate = await forexService.getUsdCadRate();

    // Collect unique FMP tickers and fetch all quotes in ONE batch API call
    const fmpTickers = [...new Set(holdings.map(h => fmpService.getFmpTicker(h.ticker, h.exchange)))];
    const quotes = await fmpService.getBatchQuotes(fmpTickers);

    // Fetch dividend data sequentially with delay to avoid rate limits
    // Dividend data is cached for 7 days, so most calls will hit DB cache
    const enriched = [];
    for (const holding of holdings) {
        try {
            const fmpTicker = fmpService.getFmpTicker(holding.ticker, holding.exchange);
            const quote = quotes[fmpTicker] || null;
            const divData = await fmpService.getDividendData(holding.ticker, holding.exchange);

            const currentPrice = quote ? quote.price : 0;
            const annualDiv = divData ? parseFloat(divData.annual_dividend) || 0 : 0;
            const shares = parseFloat(holding.shares);
            const annualIncome = annualDiv * shares;
            const marketValue = currentPrice * shares;
            const isUsd = holding.currency === 'USD';
            const cadMultiplier = isUsd ? usdCadRate : 1;

            enriched.push({
                ...holding,
                current_price: currentPrice,
                market_value: marketValue,
                market_value_cad: marketValue * cadMultiplier,
                annual_dividend_per_share: annualDiv,
                annual_income: annualIncome,
                annual_income_cad: annualIncome * cadMultiplier,
                current_yield: currentPrice > 0 ? (annualDiv / currentPrice) * 100 : 0,
                yield_on_cost: parseFloat(holding.avg_cost) > 0 ? (annualDiv / parseFloat(holding.avg_cost)) * 100 : 0,
                frequency: divData ? divData.frequency : 'Unknown',
                ex_date: divData ? divData.ex_date : null,
                payment_date: divData ? divData.payment_date : null,
                usd_cad_rate: isUsd ? usdCadRate : null
            });
        } catch (err) {
            console.error(`Error enriching ${holding.ticker}:`, err.message);
            const shares = parseFloat(holding.shares);
            const isUsd = holding.currency === 'USD';
            enriched.push({
                ...holding,
                current_price: 0,
                market_value: 0,
                market_value_cad: 0,
                annual_dividend_per_share: 0,
                annual_income: 0,
                annual_income_cad: 0,
                current_yield: 0,
                yield_on_cost: 0,
                frequency: 'Unknown',
                ex_date: null,
                payment_date: null,
                usd_cad_rate: isUsd ? usdCadRate : null
            });
        }
    }

    return enriched;
}

async function getDashboardSummary(userId, accountType) {
    const holdings = await getHoldingsWithDividends(userId, accountType);

    if (holdings.length === 0) {
        return {
            annualIncome: 0,
            portfolioValue: 0,
            holdingCount: 0,
            weightedYield: 0,
            nextPayment: null,
            topHoldings: []
        };
    }

    const totalIncomeCad = holdings.reduce((sum, h) => sum + h.annual_income_cad, 0);
    const totalValueCad = holdings.reduce((sum, h) => sum + h.market_value_cad, 0);
    const weightedYield = totalValueCad > 0 ? (totalIncomeCad / totalValueCad) * 100 : 0;

    // Find next upcoming payment
    const today = new Date().toISOString().split('T')[0];
    const upcoming = holdings
        .filter(h => h.payment_date && h.payment_date >= today)
        .sort((a, b) => a.payment_date.localeCompare(b.payment_date));

    const nextPayment = upcoming.length > 0 ? {
        ticker: upcoming[0].ticker,
        date: upcoming[0].payment_date,
        amount: upcoming[0].annual_income_cad / ({ 'Monthly': 12, 'Quarterly': 4, 'Semi-Annual': 2, 'Annual': 1 }[upcoming[0].frequency] || 4)
    } : null;

    // Top holdings by income
    const topHoldings = [...holdings]
        .sort((a, b) => b.annual_income_cad - a.annual_income_cad)
        .slice(0, 10);

    return {
        annualIncome: totalIncomeCad,
        portfolioValue: totalValueCad,
        holdingCount: holdings.length,
        weightedYield,
        nextPayment,
        topHoldings
    };
}

async function getMonthlyIncome(userId, year, accountType) {
    const holdings = await getHoldingsWithDividends(userId, accountType);

    const months = Array(12).fill(0);
    for (const holding of holdings) {
        const freq = holding.frequency;
        const perPayment = holding.annual_income_cad / ({ 'Monthly': 12, 'Quarterly': 4, 'Semi-Annual': 2, 'Annual': 1 }[freq] || 4);
        const payMonths = getPaymentMonths(freq, holding.payment_date);
        for (const m of payMonths) {
            months[m] += perPayment;
        }
    }

    return {
        year,
        months: months.map((amount, i) => ({
            month: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][i],
            amount: Math.round(amount * 100) / 100
        }))
    };
}

function getPaymentMonths(frequency, paymentDate) {
    if (frequency === 'Monthly') return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    if (frequency === 'Annual') {
        const month = paymentDate ? new Date(paymentDate).getMonth() : 5;
        return [month];
    }
    if (frequency === 'Semi-Annual') {
        const month = paymentDate ? new Date(paymentDate).getMonth() : 5;
        return [month, (month + 6) % 12];
    }
    // Quarterly default
    const startMonth = paymentDate ? new Date(paymentDate).getMonth() : 2;
    return [startMonth, (startMonth + 3) % 12, (startMonth + 6) % 12, (startMonth + 9) % 12];
}

async function getUpcomingPayments(userId, accountType) {
    const holdings = await getHoldingsWithDividends(userId, accountType);
    const today = new Date();
    const payments = [];

    for (const h of holdings) {
        if (!h.payment_date) continue;
        const freq = h.frequency;
        const perPayment = h.annual_income_cad / ({ 'Monthly': 12, 'Quarterly': 4, 'Semi-Annual': 2, 'Annual': 1 }[freq] || 4);
        const payMonths = getPaymentMonths(freq, h.payment_date);

        for (const m of payMonths) {
            const payDate = new Date(today.getFullYear(), m, new Date(h.payment_date).getDate());
            if (payDate >= today) {
                payments.push({
                    ticker: h.ticker,
                    date: payDate.toISOString().split('T')[0],
                    amount: Math.round(perPayment * 100) / 100,
                    currency: h.currency,
                    account_type: h.account_type
                });
            }
        }
    }

    return payments.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 10);
}

async function getCalendarData(userId, year, accountType) {
    const holdings = await getHoldingsWithDividends(userId, accountType);
    const calendar = {};

    for (let m = 0; m < 12; m++) {
        const monthKey = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m];
        calendar[monthKey] = { total: 0, payments: [] };
    }

    for (const h of holdings) {
        const freq = h.frequency;
        const perPayment = h.annual_income_cad / ({ 'Monthly': 12, 'Quarterly': 4, 'Semi-Annual': 2, 'Annual': 1 }[freq] || 4);
        const payMonths = getPaymentMonths(freq, h.payment_date);

        for (const m of payMonths) {
            const monthKey = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m];
            const day = h.payment_date ? new Date(h.payment_date).getDate() : 15;
            calendar[monthKey].total += perPayment;
            calendar[monthKey].payments.push({
                ticker: h.ticker,
                amount: Math.round(perPayment * 100) / 100,
                day,
                account_type: h.account_type
            });
        }
    }

    // Round totals
    for (const key of Object.keys(calendar)) {
        calendar[key].total = Math.round(calendar[key].total * 100) / 100;
    }

    return { year, calendar };
}

async function getYieldOnCostData(userId, accountType) {
    const holdings = await getHoldingsWithDividends(userId, accountType);

    return holdings.map(h => ({
        ticker: h.ticker,
        exchange: h.exchange,
        account_type: h.account_type,
        shares: parseFloat(h.shares),
        avg_cost: parseFloat(h.avg_cost),
        current_price: h.current_price,
        current_yield: h.current_yield,
        yield_on_cost: h.yield_on_cost,
        annual_dividend_per_share: h.annual_dividend_per_share,
        annual_income_cad: h.annual_income_cad,
        currency: h.currency
    })).sort((a, b) => b.yield_on_cost - a.yield_on_cost);
}

module.exports = {
    getHoldingsWithDividends,
    getDashboardSummary,
    getMonthlyIncome,
    getUpcomingPayments,
    getCalendarData,
    getYieldOnCostData
};
