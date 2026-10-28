export default function DeliveryForm() {
  return (
    <form className="delivery">
      <div className="field">
        <label htmlFor="name">Full name</label>
        <input id="name" name="name" autoComplete="name" />
      </div>
      <div className="field">
        <label htmlFor="zip">Postcode</label>
        <input id="postcode" name="postcode" autoComplete="postal-code" />
      </div>
    </form>
  );
}
