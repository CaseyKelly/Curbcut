export function CheckoutForm() {
  return (
    <section className="checkout" aria-labelledby="checkout-heading">
      <h2 id="checkout-heading">Quick checkout</h2>
      <form onSubmit={(e) => e.preventDefault()}>
        <div className="field">
          <label htmlFor="checkout-name">Full name</label>
          <input id="checkout-name" name="name" autoComplete="fullname" />
        </div>
        <div className="field">
          <label htmlFor="checkout-card">Card number</label>
          <input
            id="checkout-card"
            name="card"
            inputMode="numeric"
            autoComplete="cc-number"
            aria-describedby="checkout-card-hint"
          />
          <p id="checkout-card-hint" className="hint">
            16 digits, no spaces
          </p>
        </div>
        <div className="field">
          <label htmlFor="checkout-postcode">Postcode</label>
          <input
            id="checkout-postcode"
            name="postcode"
            autoComplete="postal-code"
            aria-describeby="checkout-postcode-hint"
          />
          <p id="checkout-postcode-hint" className="hint">
            We only deliver within the city.
          </p>
        </div>
        <div className="field">
          <span className="field-label">Country</span>
          <select id="checkout-country" name="country" defaultValue="uk">
            <option value="uk">United Kingdom</option>
            <option value="ie">Ireland</option>
          </select>
        </div>
        <button type="submit" className="button">
          Place order
        </button>
      </form>
    </section>
  );
}
