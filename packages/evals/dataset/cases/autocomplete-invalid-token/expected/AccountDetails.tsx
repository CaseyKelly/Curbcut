export default function AccountDetails() {
  return (
    <form className="account">
      <label htmlFor="account-email">Email</label>
      <input id="account-email" type="email" autoComplete="email" />
      <label htmlFor="account-phone">Phone</label>
      <input id="account-phone" type="tel" autoComplete="tel" />
    </form>
  );
}
