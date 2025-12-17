from flask import Flask, render_template, request, redirect, flash, url_for
import os
from data.database import init_db
import services.laundry_service as laundry_service
import services.dinner_service as dinner_service

app = Flask(__name__)
app.secret_key = "supersecretkey"

# intialize the database at startup
init_db()

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/laundry")
def laundry():
    bookings = laundry_service.get_bookings()
    return render_template("laundry.html", bookings=bookings)

@app.post("/book_laundry")
def book_laundry():
    date = request.form.get("date")
    slot = request.form.get("slot")
    user = request.form.get("user") or "anonymous"
    
    if not date or not slot or not user:
        flash("Please fill all fields", "error")
        return redirect(url_for("laundry"))
    
    success = laundry_service.book_slot(date, slot, user)
    if not success:
        flash("Slot is already booked. Choose another one.", "error")
        return redirect(url_for("laundry"))
    
    flash("Booking successful!", "success")
    return redirect(url_for("laundry"))

@app.route("/dinner")
def dinner():
    user_id = "demo_user"  # replace with real user system later
    week_dates = dinner_service.get_week_dates()
    dinner_data = dinner_service.get_dinner_data(user_id)
    return render_template("dinner.html", week_dates=week_dates, dinner_data=dinner_data)

@app.post("/update_dinner")
def update_dinner():
    user_id = "demo_user"  # replace with real user system later
    dinner_service.update_dinner(user_id, request.form)
    week_dates = dinner_service.get_week_dates()
    dinner_data = dinner_service.get_dinner_data(user_id)
    return render_template("dinner.html", week_dates=week_dates, dinner_data=dinner_data)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
