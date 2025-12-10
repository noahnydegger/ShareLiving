from flask import Flask, render_template, request

app = Flask(__name__)

@app.route("/")
def index():
    return render_template("index.html")

if __name__ == "__main__":
    app.run(debug=True)

@app.route("/laundry")
def laundry():
    return render_template("laundry.html")

@app.post("/book_laundry")
def book_laundry():
    date = request.form["date"]
    slot = request.form["slot"]
    return f"You booked the washing machine for {date} at {slot}"

from database import get_connection

@app.post("/book_laundry")
def book_laundry():
    date = request.form["date"]
    slot = request.form["slot"]

    con = get_connection()
    cur = con.cursor()
    cur.execute(
        "insert into laundry_bookings (date, slot, user) values (?, ?, ?)",
        (date, slot, "demo user")
    )
    con.commit()
    con.close()

    return "Booking saved"