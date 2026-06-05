export const getCalendarEvents = (subjects) => {
    const events = [];
    const today = new Date();
    // Find the Sunday of the current week
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const dayMap = { 'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6 };

    subjects.forEach(subject => {
        const targetDayOffset = dayMap[subject.day];
        if (targetDayOffset === undefined) return;

        const eventDate = new Date(startOfWeek);
        eventDate.setDate(startOfWeek.getDate() + targetDayOffset);

        const [time, modifier] = subject.time.split(' ');
        let [hours, minutes] = time.split(':');
        hours = parseInt(hours, 10);
        if (hours === 12) hours = 0;
        if (modifier === 'PM') hours += 12;
        minutes = parseInt(minutes, 10);

        const startDate = new Date(eventDate);
        startDate.setHours(hours, minutes, 0, 0);

        const endDate = new Date(startDate);
        endDate.setHours(startDate.getHours() + (subject.name.includes('Lab') ? 2 : 1));

        events.push({
            title: `${subject.code}`,
            fullTitle: subject.name,
            start: startDate,
            end: endDate,
            color: subject.color,
            teacher: subject.teacher
        });
    });

    return events;
};

