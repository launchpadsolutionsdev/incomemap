function calculate({ currentAnnualIncome, portfolioValue, monthlyContribution, dividendGrowthRate, averageYield, years }) {
    const growthRate = dividendGrowthRate / 100;
    const yieldRate = averageYield / 100;

    const withDrip = [];
    const withoutDrip = [];

    let dripValue = portfolioValue;
    let dripIncome = currentAnnualIncome;

    let noDripValue = portfolioValue;
    let noDripIncome = currentAnnualIncome;

    for (let year = 0; year <= years; year++) {
        withDrip.push({
            year,
            portfolioValue: Math.round(dripValue * 100) / 100,
            annualIncome: Math.round(dripIncome * 100) / 100
        });

        withoutDrip.push({
            year,
            portfolioValue: Math.round(noDripValue * 100) / 100,
            annualIncome: Math.round(noDripIncome * 100) / 100
        });

        if (year < years) {
            // With DRIP: reinvest dividends + add contributions
            dripValue += dripIncome + (monthlyContribution * 12);
            dripIncome = dripValue * yieldRate * (1 + growthRate * year / years);

            // Without DRIP: only add contributions, dividends are withdrawn
            noDripValue += monthlyContribution * 12;
            noDripIncome = noDripValue * yieldRate * (1 + growthRate * year / years);
        }
    }

    return {
        withDrip,
        withoutDrip,
        summary: {
            finalIncomeWithDrip: withDrip[withDrip.length - 1].annualIncome,
            finalIncomeWithoutDrip: withoutDrip[withoutDrip.length - 1].annualIncome,
            finalValueWithDrip: withDrip[withDrip.length - 1].portfolioValue,
            finalValueWithoutDrip: withoutDrip[withoutDrip.length - 1].portfolioValue,
            dripAdvantage: withDrip[withDrip.length - 1].annualIncome - withoutDrip[withoutDrip.length - 1].annualIncome
        }
    };
}

module.exports = { calculate };
