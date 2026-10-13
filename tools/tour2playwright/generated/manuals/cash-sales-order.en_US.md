# Cash Sales Order

How to create a cash sales order in Odoo and take it all the way through delivery, invoice and payment.

**Module:** Sales · **Language:** English · **Steps:** 35

---

## Part 1 — Create the quotation

1. **Open the Sales app.** Click the **Sales** module in the main menu.
2. **Open Orders.** Click **Orders**.
3. **Open Quotations.** Click **Quotations**.
4. **Start a new quotation.** Click the **New** button.
5. **Find the customer.** Click the **Customer** field and start typing the customer's name.
6. **Select the customer.** Click the matching customer in the dropdown list.
7. **Choose the payment method.** In **Order Payment Type**, select **Cash**.
8. **Choose the quotation type.** In **Quotation Type**, select **Sales**.

## Part 2 — Add the product

9. **Add a line.** In the order lines table, click **Add a product**.
10. **Search the product.** Type the product name or code in the **Product** field (for example `02BB 023`).
11. **Select the product.** Click the product in the dropdown, for example **[02BB 023] BALL BEARING 6202-2RS**.
12. **Set the quantity.** Click the **Quantity** cell and enter the quantity (default `1.0000`).

## Part 3 — Other Info tab

13. **Open Other Info.** Click the **Other Info** tab.
14. **Open Payment Terms.** Click the **Payment Terms** field. The default may be **90 Days**.
15. **Pick Immediate Payment.** Select **Immediate Payment**, because this is a cash order.
16. **Open Sales Team.** Click the **Sales Team** field.
17. **Search more.** Click **Search More...** at the bottom of the dropdown.
18. **Select the team.** In the list, click **Colombo Sales Centre**.
19. **Open Warehouse.** Click the **Warehouse** field.
20. **Search more.** Click **Search More...**.
21. **Select the warehouse.** Click **JAM Warehouse Ekala- (JM-EK)**.

## Part 4 — Confirm and deliver

22. **Confirm the order.** Click **Confirm**. The quotation becomes a sales order.
23. **Open the delivery.** Click the **Delivery** smart button.
24. **Validate the delivery.** Click **Validate**.
25. **Go back to the order.** Click the order reference in the breadcrumb (for example **S01881**).

## Part 5 — Invoice

26. **Create the invoice.** Click **Create Invoice**.
27. **Confirm the invoice.** Click **Confirm** on the invoice.
28. **Check the source order.** Click the **Sale Orders** smart button to confirm the link back to the order.
29. **Open the invoice again.** Click the **Invoices** smart button.

## Part 6 — Register the payment

30. **Register payment.** Click **Register Payment**.
31. **Open Journal.** Click the **Journal** field (bank).
32. **Search more.** Click **Search More...**.
33. **Select the cash journal.** Click **Customer Receipts - Cash**.
34. **Create the payment.** Click **Create Payment**.
35. **Verify the links.** Click the **Sale Orders** smart button, then the **Invoices** smart button, to check that order, invoice and payment are linked.

---

## Notes

- Steps 14–15: always use **Immediate Payment** for cash orders, not 90 Days.
- Steps 24, 27 and 34 are real accounting actions and cannot be undone casually. Practise on a test database.
- Screenshots are not included. Run the tour2playwright pipeline against this export to generate them.
