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
    attendees = dinner_service.get_attendees()
    cook = dinner_service.get_cook()
    return render_template("dinner.html", attendees=attendees, cook=cook)

@app.post("/update_dinner")
def update_dinner():
    selected_days = request.form.getlist("days")
    cook = request.form["cook"]
    dinner_service.update(selected_days, cook)
    return redirect("/dinner")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
