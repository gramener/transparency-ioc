import os
import csv
import codecs
import cStringIO
import urllib
import hashlib
import itertools
import lxml.html

BASE = 'http://spandan.indianoil.co.in/transparency/'

if not os.path.exists('cache'):
    os.makedirs('cache')

def get(url):
    """Returns an lxml tree of a URL, cached"""
    filename = os.path.join('cache', hashlib.sha1(url).hexdigest())
    if not os.path.exists(filename):
        urllib.urlretrieve(url, filename)
    return lxml.html.fromstring(open(filename).read())

def options(fn):
    """Return the <option> id and text content of provided tree"""
    def wrapped(*args, **kwargs):
        for option in fn(*args, **kwargs):
            if option.get('value'):
                yield option.get('value'), option.text_content()
    return wrapped

@options
def states():
    return get(BASE).cssselect('#bgstate option')

@options
def cities(state):
    return get(BASE + 'get_city3.php?id=' + state).cssselect('option')

@options
def distributors(state, city):
    return get(BASE + 'get_dealer_2.php?id=%s&stateID=%s' % (city, state)).cssselect('option')

def people(state, city, dist):
    for page in itertools.count(1):
        tree = get(BASE + 'report-new.php?bgstate=%s&city=%s&txtDistributor=%s&&start=%d&lstYear=2012-2013&RdConsType=Domestic' % (state, city, dist, page))
        rows = tree.cssselect('tr[class^=row]')
        if len(rows) == 0:
            break
        for row in rows:
            cells = [cell.text_content().strip() for cell in row.cssselect('td')]
            cells[-1] = cells[-1].replace(',', '')
            yield cells


class UnicodeWriter:
    """
    A CSV writer which will write rows to CSV file "f",
    which is encoded in the given encoding.
    """

    def __init__(self, f, dialect=csv.excel, encoding="utf-8", **kwds):
        # Redirect output to a queue
        self.queue = cStringIO.StringIO()
        self.writer = csv.writer(self.queue, dialect=dialect, **kwds)
        self.stream = f
        self.encoder = codecs.getincrementalencoder(encoding)()

    def writerow(self, row):
        self.writer.writerow([s.encode("utf-8") for s in row])
        data = self.queue.getvalue()
        data = data.decode("utf-8")
        data = self.encoder.encode(data)
        self.stream.write(data)
        self.queue.truncate(0)

    def writerows(self, rows):
        for row in rows:
            self.writerow(row)


if __name__ == '__main__':
    fp = open('gas.csv', 'w')
    out = UnicodeWriter(fp, lineterminator='\n')
    header = 'State,City,Dist,S.No,Consumer No,Consumer Name,Address,Refills,Before,After-Subsidized,After-Non-Subsidized,Subsidy Rs'.split(',')
    out.writerow(header)
    for state_id, state_name in states():
        for city_id, city_name in cities(state_id):
            for dist_id, dist_name in distributors(state_id, city_id):
                print state_name, city_name, dist_id
                for row in people(state_id, city_id, dist_id):
                    out.writerow([state_id, city_id, dist_id] + row)
                    fp.flush()
