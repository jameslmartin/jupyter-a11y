import re
import os
import pandas as pd
import glob
import pandas
import mmap
import ntpath

files_to_be_searched = []

# Might want to recode this path
for path, subdirs, files in os.walk(r'/Users/james/Documents/code/thesis-notebooks/notebook/'):
    for filename in files:
        if filename.endswith('.js') or filename.endswith('.py'):
            files_to_be_searched.append(os.path.join(path, filename))

 # Note: search_term needs to be in byte format, easiest (only?) way to do this is to prefix the string with a 'b'
 def search_files_for_term(search_term, files_to_be_searched):
     narrowed_files = []
     # Narrow down files
     for file in files_to_be_searched:
         if os.stat(file).st_size != 0: # If file is not empty
             open_file = open(file,'r')
             # Create a memory map for easy searching
             mem_map = mmap.mmap(open_file.fileno(), 0, access=mmap.ACCESS_READ)
             if mem_map.find(search_term) != -1:
                  narrowed_files.append(file)
                     
     # Search files for lines containing search term    
    search_results = []
    for file in narrowed_files:
        #head, tail = ntpath.split(file)
        file_path = file.split('thesis-notebooks/notebook/')[1]
        search_term_as_string = search_term.decode('utf-8')
        line_tuples = get_line_number_and_string(search_term_as_string, file)
        for line in line_tuples:
            search_results.append([file_path,line[0],line[1]])

    return search_results

def get_line_number_and_string(search_term, filename):
    line_numbers = []
    with open(filename) as f:
        for i, line_text in enumerate(f):
        	line_number = i+1
            if str(search_term) in line_text:
            	line_numbers.append((line_number,line_text))
    return line_numbers

search_term = b'events.trigger'

results = search_files_for_term(search_term, files_to_be_searched)

idx = list(range(1,len(results)))
events_trigger = pd.DataFrame(results, columns=['File', 'Line Number', 'Snippet'])

import pickle
output = open('event_triggers.pkl', 'wb')
pickle.dump(events_trigger, output)
output.close()

for i in events_trigger.index:
    lineNum = events_trigger['Line Number'][i]
    link_string = "https://github.com/jupyter/notebook/blob/master/" + str(events_trigger['File'][i]) + "#L" + str(lineNum)
    events_trigger['Line Number'][i] = "<a href=\"" + link_string + "\">" + str(lineNum) + "</a>"


pd.set_option('display.max_colwidth', -1)
events_trigger.to_html("events.html")