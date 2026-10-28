export default function OrderHistory() {
  return (
    <table className="orders">
      <caption>Your orders</caption>
      <thead>
        <tr>
          <th scope="col">Order</th>
          <th scope="col">Total</th>
          <th scope="col">Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>#10482</td>
          <td>£58.00</td>
          <td>
            <a href="/account/orders/10482/r">
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M2 8a6 6 0 1 0 2-4.5M2 2v4h4" fill="none" stroke="currentColor" />
              </svg>
            </a>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
